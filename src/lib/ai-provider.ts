/** Provider-agnostic contract for the smart layer.
 *
 *  §4 ships Groq only in v1, but requires the architecture to allow adding
 *  others later — so every feature depends on this interface rather than on
 *  Groq directly, and a second provider is a new implementation file rather
 *  than a refactor of the call sites. */

export interface AiRequest {
  /** Framing instruction — what role the model is playing for this feature. */
  system: string;
  /** The actual content to act on. */
  user: string;
  /** Upper bound on response length; providers map this to their own param. */
  maxTokens?: number;
}

export interface AiProvider {
  readonly name: string;
  /** Resolves with the model's text response, or rejects with an AiError. */
  complete(request: AiRequest, apiKey: string, signal?: AbortSignal): Promise<string>;
}

export type AiErrorKind = 'invalid-key' | 'rate-limit' | 'timeout' | 'network' | 'bad-response';

/** Errors carry a machine-readable kind so callers can distinguish "your key
 *  is wrong" (worth surfacing) from "the network blipped" (worth retrying or
 *  silently falling back) — §10.4. */
export class AiError extends Error {
  constructor(
    readonly kind: AiErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

/** Human-readable, non-alarming text for each failure kind. Shown in the small
 *  inline notes described in §10.4 — never a raw error or stack trace. */
export function describeAiError(error: unknown): string {
  if (!(error instanceof AiError)) return 'Something went wrong reaching the smart layer.';

  switch (error.kind) {
    case 'invalid-key':
      return 'Your API key was rejected. Check it in Settings.';
    case 'rate-limit':
      return 'The smart layer is rate limited right now.';
    case 'timeout':
      return 'The smart layer took too long to respond.';
    case 'network':
      return "Couldn't reach the smart layer.";
    case 'bad-response':
      return 'The smart layer returned something unexpected.';
  }
}
