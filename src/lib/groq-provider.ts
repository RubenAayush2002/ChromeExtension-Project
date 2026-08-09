import { AiError, type AiProvider, type AiRequest } from './ai-provider';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const DEFAULT_TIMEOUT_MS = 10_000;

interface GroqChoice {
  message?: { content?: string };
}

interface GroqResponse {
  choices?: GroqChoice[];
}

/** Maps an HTTP status onto the shared error taxonomy. 401/403 mean the key is
 *  bad; 429 is a rate limit; everything else is treated as a network-level
 *  failure so callers fall back rather than surfacing a status code. */
function errorForStatus(status: number): AiError {
  if (status === 401 || status === 403) return new AiError('invalid-key', `Groq rejected the API key (${status}).`);
  if (status === 429) return new AiError('rate-limit', 'Groq rate limit reached.');
  return new AiError('network', `Groq request failed (${status}).`);
}

export function createGroqProvider(
  model: string = DEFAULT_MODEL,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch,
): AiProvider {
  return {
    name: 'groq',

    async complete(request: AiRequest, apiKey: string, signal?: AbortSignal): Promise<string> {
      // Own timeout controller, linked to any caller-supplied signal so either
      // can abort the request.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const onAbort = () => controller.abort();
      signal?.addEventListener('abort', onAbort);

      let response: Response;
      try {
        response = await fetchImpl(GROQ_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: request.system },
              { role: 'user', content: request.user },
            ],
            max_tokens: request.maxTokens ?? 512,
            temperature: 0.2,
          }),
          signal: controller.signal,
        });
      } catch (err) {
        // An abort here is almost always our own timeout firing; a caller
        // aborting deliberately surfaces the same way and falls back too.
        if (err instanceof Error && err.name === 'AbortError') {
          throw new AiError('timeout', `Groq did not respond within ${timeoutMs}ms.`);
        }
        throw new AiError('network', 'Could not reach Groq.');
      } finally {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', onAbort);
      }

      if (!response.ok) throw errorForStatus(response.status);

      let payload: GroqResponse;
      try {
        payload = (await response.json()) as GroqResponse;
      } catch {
        throw new AiError('bad-response', 'Groq returned a malformed response.');
      }

      const content = payload.choices?.[0]?.message?.content?.trim();
      if (!content) throw new AiError('bad-response', 'Groq returned an empty response.');

      return content;
    },
  };
}
