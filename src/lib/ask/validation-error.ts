/** Thrown when request input is invalid (maps to HTTP 400 in API routes). */
export class AskValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AskValidationError";
  }
}
