import { NextResponse } from "next/server";

import { jsonApiFailure } from "@/lib/http/json-response";
import {
  askRouteFailure,
  completeAskExchange,
  prepareAskRoute,
} from "@/lib/ask/route-runtime";

// Match web Ask: a live assessment can run beyond the platform default.
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const prepared = await prepareAskRoute(request, "mobile Ask", true);
    if (!prepared.ok) return jsonApiFailure(prepared.failure);

    const response = await completeAskExchange(prepared.value);
    return NextResponse.json(response);
  } catch (error) {
    return jsonApiFailure(askRouteFailure(error, "Mobile Ask response generation failed."));
  }
}
