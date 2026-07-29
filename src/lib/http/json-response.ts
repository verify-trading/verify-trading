import { NextResponse } from "next/server";

/** Every authenticated API answer is per-trader — nothing here may sit in a shared cache. */
export const PRIVATE_CACHE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;

export function jsonUnauthorized(message: string) {
  return NextResponse.json({ error: "unauthorized", message }, { status: 401 });
}

export function jsonInvalidRequest(message: string) {
  return NextResponse.json({ error: "invalid_request", message }, { status: 400 });
}

export function jsonApiError(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

export function jsonApiFailure(failure: {
  status: number;
  error: string;
  message: string;
  code?: string;
  remaining?: number;
}) {
  return NextResponse.json(
    {
      error: failure.error,
      message: failure.message,
      ...(failure.code ? { code: failure.code } : {}),
      ...(failure.remaining !== undefined ? { remaining: failure.remaining } : {}),
    },
    { status: failure.status },
  );
}
