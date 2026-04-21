/**
 * HttpError mirrors FastAPI's HTTPException.
 * Middleware converts thrown HttpErrors into `{detail: string}` JSON responses.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'HttpError';
    this.status = status;
    this.detail = detail;
  }
}

export const badRequest = (detail: string) => new HttpError(400, detail);
export const notFound = (detail: string) => new HttpError(404, detail);
export const conflict = (detail: string) => new HttpError(409, detail);
export const serverError = (detail: string) => new HttpError(500, detail);
