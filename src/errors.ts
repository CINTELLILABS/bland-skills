import type { ApiError } from "./types.js";

export class BlandError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public apiErrors?: ApiError[]
  ) {
    super(message);
    this.name = "BlandError";
  }
}

export class AuthError extends BlandError {
  constructor(
    message = "Not authenticated. Set BLAND_API_KEY environment variable or run `bland auth login`."
  ) {
    super(message, 401);
    this.name = "AuthError";
  }
}
