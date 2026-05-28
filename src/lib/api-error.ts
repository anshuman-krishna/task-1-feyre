export class ApiError extends Error {
  constructor(
    message: string,
    public status: number = 500,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const NotFound = (entity = "resource") => new ApiError(`${entity} not found`, 404, "not_found");
export const BadRequest = (msg: string, details?: unknown) => new ApiError(msg, 400, "bad_request", details);
export const Conflict = (msg: string) => new ApiError(msg, 409, "conflict");
export const Unauthorized = () => new ApiError("unauthorized", 401, "unauthorized");
