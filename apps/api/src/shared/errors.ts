// Domain error types for the API.
//
// Services throw AppError (with a stable machine code + HTTP status); the
// centralized Fastify error handler maps these to the shared ApiError envelope.
// This keeps HTTP concerns out of the service layer while giving clients a
// consistent, documented error shape.

/**
 * An application-level error carrying an HTTP status and a stable error code.
 * Use the named factory helpers below rather than constructing by hand so
 * codes stay consistent across the codebase.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/** 400 — the request was malformed or violated a business rule. */
export function badRequest(code: string, message: string): AppError {
  return new AppError(400, code, message);
}

/** 401 — authentication is missing or invalid. */
export function unauthorized(message = 'Authentication required'): AppError {
  return new AppError(401, 'UNAUTHORIZED', message);
}

/** 403 — authenticated but not allowed to access this resource. */
export function forbidden(message = 'You do not have access to this resource'): AppError {
  return new AppError(403, 'FORBIDDEN', message);
}

/** 404 — the requested resource does not exist (or is not visible to the caller). */
export function notFound(message = 'Resource not found'): AppError {
  return new AppError(404, 'NOT_FOUND', message);
}

/** 409 — the request conflicts with current state (duplicate, invalid transition). */
export function conflict(code: string, message: string): AppError {
  return new AppError(409, code, message);
}
