import { NextResponse } from "next/server";

export function jsonUnauthorized(message: string) {
  return NextResponse.json({ error: "unauthorized", message }, { status: 401 });
}

export function jsonInvalidRequest(message: string) {
  return NextResponse.json({ error: "invalid_request", message }, { status: 400 });
}

export function jsonApiError(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}
