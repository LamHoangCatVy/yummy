/**
 * Global error handler — mirrors FastAPI's HTTPException response shape:
 *   { "detail": "<message>" }
 *
 * Wire as: app.onError(errorHandler)
 */
import type { Context } from 'hono';
import { HttpError } from '../lib/errors.js';
import { ZodError } from 'zod';

export function errorHandler(err: Error, c: Context): Response {
  if (err instanceof HttpError) {
    return c.json({ detail: err.detail }, err.status as 400 | 404 | 409 | 500);
  }

  if (err instanceof ZodError) {
    // Pydantic returns 422 for body validation failures; FastAPI does too.
    const first = err.issues[0];
    const detail = first
      ? `${first.path.join('.') || 'body'}: ${first.message}`
      : 'Validation error';
    return c.json({ detail }, 422);
  }

  // Unhandled — log and surface as 500 with same shape as FastAPI default.
  console.error('[unhandled]', err);
  return c.json({ detail: err.message || 'Internal server error' }, 500);
}
