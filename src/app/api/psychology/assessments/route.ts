import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { hasProAccess } from "@/lib/billing/require-pro";
import { jsonApiError, jsonUnauthorized, PRIVATE_CACHE_HEADERS } from "@/lib/http/json-response";
import { logger } from "@/lib/observability/logger";
import {
  psychologyAssessmentCreateSchema,
  psychologyAssessmentsQuerySchema,
  scorePsychologyAssessment,
  toPsychologyAssessment,
  type PsychologyAssessmentRow,
} from "@/lib/psychology/assessment";

export async function GET(request: Request) {
  const parsedQuery = psychologyAssessmentsQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );

  if (!parsedQuery.success) {
    return jsonApiError(400, "psychology_assessments_request_invalid", "The psychology assessments request is invalid.");
  }

  try {
    const session = await getSessionUser();
    if (!session) {
      return jsonUnauthorized("Sign in to load psychology assessments.");
    }

    const { data, error } = await session.supabase
      .from("psychology_assessments")
      .select("id, section_scores, total_score, max_score, zone_label, focus_area, summary, answers, q29_focus, created_at, updated_at")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(parsedQuery.data.limit);

    if (error || !data) {
      return jsonApiError(500, "psychology_assessments_unavailable", "Could not load psychology assessments right now.");
    }

    return NextResponse.json(
      { assessments: (data as PsychologyAssessmentRow[]).map(toPsychologyAssessment) },
      { headers: PRIVATE_CACHE_HEADERS },
    );
  } catch (error) {
    logger.error("Psychology assessments request failed.", {
      error: error instanceof Error ? error.message : "unknown",
    });

    return jsonApiError(500, "psychology_assessments_unavailable", "Could not load psychology assessments right now.");
  }
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonApiError(400, "psychology_assessment_invalid", "The psychology assessment request body is invalid.");
  }

  const parsedBody = psychologyAssessmentCreateSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonApiError(400, "psychology_assessment_invalid", "The psychology assessment request body is invalid.");
  }

  try {
    const session = await getSessionUser();
    if (!session) {
      return jsonUnauthorized("Sign in to save psychology assessments.");
    }
    // The WRITE is gated, not the read, so a lapsed Pro keeps reading assessments they paid for.
    if (!(await hasProAccess(session))) {
      return jsonApiError(403, "psychology_pro_required", "The Mind assessment is a Pro feature.");
    }

    const result = scorePsychologyAssessment(parsedBody.data.sectionScores);
    const { data, error } = await session.supabase
      .from("psychology_assessments")
      .insert({
        user_id: session.user.id,
        section_scores: result.sectionScores,
        total_score: result.totalScore,
        max_score: result.maxScore,
        zone_label: result.zoneLabel,
        focus_area: result.focusArea,
        summary: result.summary,
        answers: parsedBody.data.answers ?? null,
        q1_trading_situation: parsedBody.data.q1TradingSituation,
        q2_stress_level: parsedBody.data.q2StressLevel,
        q3_financial_situation: parsedBody.data.q3FinancialSituation,
        q4_sleep_quality: parsedBody.data.q4SleepQuality,
        q5_energy_level: parsedBody.data.q5EnergyLevel,
        q29_focus: parsedBody.data.q29Focus,
        flag_chasing: parsedBody.data.flags.chasing,
        flag_compulsive: parsedBody.data.flags.compulsive,
        flag_financial_pressure: parsedBody.data.flags.financialPressure,
        flag_sleep_poor: parsedBody.data.flags.sleepPoor,
        flag_rebuilding: parsedBody.data.flags.rebuilding,
      })
      .select("id, section_scores, total_score, max_score, zone_label, focus_area, summary, answers, q29_focus, created_at, updated_at")
      .single();

    if (error || !data) {
      return jsonApiError(500, "psychology_assessment_save_failed", "Could not save the psychology assessment right now.");
    }

    return NextResponse.json(
      { assessment: toPsychologyAssessment(data as PsychologyAssessmentRow) },
      { status: 201, headers: PRIVATE_CACHE_HEADERS },
    );
  } catch (error) {
    logger.error("Psychology assessment save failed.", {
      error: error instanceof Error ? error.message : "unknown",
    });

    return jsonApiError(500, "psychology_assessment_save_failed", "Could not save the psychology assessment right now.");
  }
}
