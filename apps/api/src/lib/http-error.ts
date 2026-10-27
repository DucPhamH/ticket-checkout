// Thrown from services/controllers; turned into a JSON response by the error handler.
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }

  static badRequest(code: string, message: string) {
    return new HttpError(400, code, message);
  }

  static unauthorized(code: string, message: string) {
    return new HttpError(401, code, message);
  }

  static notFound(code: string, message: string) {
    return new HttpError(404, code, message);
  }

  static conflict(code: string, message: string) {
    return new HttpError(409, code, message);
  }
}
