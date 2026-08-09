import { describe, it, expect } from 'vitest';
import { createGroqProvider } from '../groq-provider';
import { AiError } from '../ai-provider';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const REQUEST = { system: 'be helpful', user: 'hello' };

function completionBody(content: string) {
  return { choices: [{ message: { content } }] };
}

async function expectAiError(promise: Promise<unknown>, kind: string) {
  await expect(promise).rejects.toBeInstanceOf(AiError);
  await promise.catch((err: AiError) => expect(err.kind).toBe(kind));
}

describe('groq provider', () => {
  it('returns the completion text on success', async () => {
    const provider = createGroqProvider('model', 5000, async () => jsonResponse(completionBody('  the answer  ')));

    expect(await provider.complete(REQUEST, 'gsk_key')).toBe('the answer');
  });

  it('sends the key as a bearer token to the Groq endpoint', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    const provider = createGroqProvider('llama-test', 5000, async (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;
      return jsonResponse(completionBody('ok'));
    });

    await provider.complete(REQUEST, 'gsk_secret');

    expect(capturedUrl).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect((capturedInit!.headers as Record<string, string>).Authorization).toBe('Bearer gsk_secret');
    expect(JSON.parse(capturedInit!.body as string).model).toBe('llama-test');
  });

  it('classifies a 401 as an invalid key', async () => {
    const provider = createGroqProvider('m', 5000, async () => jsonResponse({}, 401));
    await expectAiError(provider.complete(REQUEST, 'bad'), 'invalid-key');
  });

  it('classifies a 429 as a rate limit', async () => {
    const provider = createGroqProvider('m', 5000, async () => jsonResponse({}, 429));
    await expectAiError(provider.complete(REQUEST, 'gsk_k'), 'rate-limit');
  });

  it('classifies a 500 as a network failure', async () => {
    const provider = createGroqProvider('m', 5000, async () => jsonResponse({}, 500));
    await expectAiError(provider.complete(REQUEST, 'gsk_k'), 'network');
  });

  it('reports a timeout when the request aborts', async () => {
    const provider = createGroqProvider('m', 10, (_url, init) => {
      // Never resolves on its own; rejects the way fetch does on abort.
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });

    await expectAiError(provider.complete(REQUEST, 'gsk_k'), 'timeout');
  });

  it('reports a network error when fetch rejects outright', async () => {
    const provider = createGroqProvider('m', 5000, async () => {
      throw new TypeError('Failed to fetch');
    });

    await expectAiError(provider.complete(REQUEST, 'gsk_k'), 'network');
  });

  it('rejects an empty completion rather than returning blank text', async () => {
    const provider = createGroqProvider('m', 5000, async () => jsonResponse(completionBody('   ')));
    await expectAiError(provider.complete(REQUEST, 'gsk_k'), 'bad-response');
  });

  it('rejects a response missing the expected shape', async () => {
    const provider = createGroqProvider('m', 5000, async () => jsonResponse({ unexpected: true }));
    await expectAiError(provider.complete(REQUEST, 'gsk_k'), 'bad-response');
  });

  it('rejects a malformed JSON body', async () => {
    const provider = createGroqProvider('m', 5000, async () =>
      ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('bad json');
        },
      }) as unknown as Response,
    );

    await expectAiError(provider.complete(REQUEST, 'gsk_k'), 'bad-response');
  });
});
