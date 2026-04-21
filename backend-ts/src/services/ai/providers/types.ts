/**
 * Common types for AI provider implementations.
 */

/** Result of a blocking provider call. */
export interface CallResult {
  text: string;
  inTokens?: number | null;
  outTokens?: number | null;
}

/** Async iterable of text chunks. */
export type StreamChunks = AsyncGenerator<string, void, unknown>;
