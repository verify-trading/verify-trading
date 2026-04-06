import { z } from "zod";

import { lookupVerifiedEntity } from "@/lib/ask/entities";
import { fetchWithRetry } from "@/lib/http/fetch-with-retry";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const getFcaStatusInputSchema = z.object({
  name: z.string().min(1),
  frn: z.string().trim().min(1).optional(),
});

export interface FcaStatusResult {
  available: boolean;
  queriedName: string;
  frn: string | null;
  authorised: boolean | null;
  warning: boolean | null;
  statusText: string | null;
  source: string;
  note: string | null;
}

function extractFirstObject(value: unknown): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    const first = value.find(
      (item) => item && typeof item === "object" && !Array.isArray(item),
    );
    return first ? (first as Record<string, unknown>) : null;
  }

  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }

  return null;
}

function toBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "authorised", "authorized"].includes(normalized)) {
      return true;
    }

    if (["false", "no", "unauthorised", "unauthorized"].includes(normalized)) {
      return false;
    }
  }

  return null;
}

function toStringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function extractResponseDataRecord(payload: unknown) {
  const record = (
    extractFirstObject((payload as Record<string, unknown>)?.Data) ??
    extractFirstObject((payload as Record<string, unknown>)?.data) ??
    extractFirstObject((payload as Record<string, unknown>)?.firm) ??
    extractFirstObject((payload as Record<string, unknown>)?.results) ??
    extractFirstObject(payload)
  );

  if (!record) {
    return null;
  }

  const hasRecognizedFirmField = [
    "FRN",
    "frn",
    "Status",
    "status",
    "Organisation Name",
    "Organization Name",
    "Business Type",
    "Exceptional Info Details",
    "firmStatus",
    "authorisationStatus",
    "authorizationStatus",
  ].some((key) => key in record);

  return hasRecognizedFirmField ? record : null;
}

function parseExceptionalInfo(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const notes = value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const title =
        toStringOrNull(record["Exceptional Info Title"]) ??
        toStringOrNull(record.title);
      const body =
        toStringOrNull(record["Exceptional Info Body"]) ??
        toStringOrNull(record.body);

      if (!title && !body) {
        return null;
      }

      return [title, body].filter(Boolean).join(": ");
    })
    .filter((entry): entry is string => Boolean(entry));

  if (notes.length === 0) {
    return null;
  }

  return notes.join(" | ");
}

function parseFirmDetailsPayload(payload: unknown, queriedName: string, fallbackFrn?: string | null) {
  const object = extractResponseDataRecord(payload);
  if (!object) {
    return null;
  }

  const statusText =
    toStringOrNull(object["Status"]) ??
    toStringOrNull(object.status) ??
    toStringOrNull(object.firmStatus) ??
    toStringOrNull(object.authorisationStatus) ??
    toStringOrNull(object.authorizationStatus);
  const frn =
    toStringOrNull(object["FRN"]) ??
    toStringOrNull(object.frn) ??
    toStringOrNull(object.referenceNumber) ??
    toStringOrNull(object.firmReferenceNumber) ??
    fallbackFrn ??
    null;
  const businessType =
    toStringOrNull(object["Business Type"]) ??
    toStringOrNull(object.businessType);
  const subStatus =
    toStringOrNull(object["Sub-Status"]) ??
    toStringOrNull(object.subStatus);
  const exceptionalInfo = parseExceptionalInfo(object["Exceptional Info Details"]);
  const note = [
    exceptionalInfo,
    subStatus ? `Sub-status: ${subStatus}` : null,
    businessType ? `Business type: ${businessType}` : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" | ") || null;

  const authorised =
    toBoolean(object.authorised) ??
    toBoolean(object.authorized) ??
    (statusText
      ? /authorised|authorized|active|registered/i.test(statusText)
      : null);

  const warning =
    toBoolean(object.warning) ??
    toBoolean(object.warningListed) ??
    toBoolean(object.warning_listed) ??
    (note ? /caution|warning|compromise|administration|dissolved|clone/i.test(note) : null) ??
    (statusText ? /warning|unauthorised|unauthorized|clone|revoked|cancelled|cancelled/i.test(statusText) : null);

  if (!frn && authorised === null && warning === null && !statusText && !note) {
    return null;
  }

  return {
    available: true,
    queriedName,
    frn,
    authorised,
    warning,
    statusText,
    source: "FCA live lookup",
    note,
  } satisfies FcaStatusResult;
}

function parseRegulatorsPayload(payload: unknown) {
  const data = (payload as Record<string, unknown>)?.Data;
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      return toStringOrNull((entry as Record<string, unknown>)["Regulator Name"]);
    })
    .filter((name): name is string => Boolean(name));
}

function withHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (process.env.FCA_API_KEY) {
    headers["X-AUTH-KEY"] = process.env.FCA_API_KEY;
    headers["x-auth-key"] = process.env.FCA_API_KEY;
  }
  if (process.env.FCA_API_EMAIL) {
    headers["X-AUTH-EMAIL"] = process.env.FCA_API_EMAIL;
    headers["x-auth-email"] = process.env.FCA_API_EMAIL;
  }

  return headers;
}

async function fetchFcaPayload(url: string) {
  const response = await fetchWithRetry(url, {
    headers: withHeaders(),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`FCA lookup failed with ${response.status}`);
  }

  return (await response.json()) as unknown;
}

async function getMappedFrn(name: string) {
  const client = getSupabaseAdminClient();
  if (!client) {
    return null;
  }

  const { data } = await client
    .from("broker_entity_map")
    .select("fca_reference")
    .eq("broker_name", name)
    .maybeSingle();

  return data?.fca_reference ?? null;
}

async function getResolvedFrn(name: string, fallbackFrn?: string) {
  if (fallbackFrn) {
    return fallbackFrn;
  }

  const mappedFrn = await getMappedFrn(name);
  if (mappedFrn) {
    return mappedFrn;
  }

  const lookup = await lookupVerifiedEntity(name);
  return lookup.entity?.fcaReference ?? null;
}

async function getSeedFallback(name: string) {
  const lookup = await lookupVerifiedEntity(name);
  if (!lookup.found || !lookup.entity) {
    return null;
  }

  return {
    available: false,
    queriedName: lookup.entity.name,
    frn: lookup.entity.fcaReference,
    authorised: lookup.entity.fcaRegistered,
    warning: lookup.entity.fcaWarning,
    statusText: lookup.entity.fcaRegistered ? "Authorised in seed data" : "Not authorised in seed data",
    source: lookup.entity.source,
    note: lookup.entity.notes,
  } satisfies FcaStatusResult;
}

async function searchFcaByName(name: string): Promise<FcaStatusResult | null> {
  const endpoint = process.env.FCA_FIRM_LOOKUP_URL?.trim().replace(/\/+$/, "");
  if (!endpoint) {
    return null;
  }

  try {
    const url = `${endpoint}/Search?q=${encodeURIComponent(name)}&type=firm`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-AUTH-KEY": process.env.FCA_API_KEY ?? "",
        "X-AUTH-EMAIL": process.env.FCA_API_EMAIL ?? "",
      },
      cache: "no-store",
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json() as Record<string, unknown>;
    const data = payload?.Data;
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    const first = data[0] as Record<string, unknown>;
    const frn =
      toStringOrNull(first["Reference Number"]) ??
      toStringOrNull(first["FRN"]) ??
      toStringOrNull(first.frn) ??
      null;
    const firmName =
      toStringOrNull(first["Name"]) ??
      toStringOrNull(first["Organisation Name"]) ??
      toStringOrNull(first.name) ??
      name;
    const statusText =
      toStringOrNull(first["Status"]) ??
      toStringOrNull(first.status) ??
      toStringOrNull(first.firmStatus) ??
      null;
    const authorised =
      toBoolean(first.authorised) ??
      toBoolean(first.authorized) ??
      (statusText ? /authorised|authorized|active|registered/i.test(statusText) : null);
    const warning =
      toBoolean(first.warning) ??
      toBoolean(first.warningListed) ??
      (statusText ? /warning|unauthorised|unauthorized|clone|revoked|cancelled|no longer authorised/i.test(statusText) : null);

    if (!frn && !statusText) {
      return null;
    }

    return {
      available: true,
      queriedName: name,
      frn,
      authorised,
      warning,
      statusText,
      source: "FCA name search",
      note: `Matched firm: ${firmName}. Confirm this is the correct entity before relying on this result.`,
    };
  } catch {
    return null;
  }
}

export async function getFcaStatus(input: z.infer<typeof getFcaStatusInputSchema>) {
  const parsed = getFcaStatusInputSchema.parse(input);
  const resolvedFrn = await getResolvedFrn(parsed.name, parsed.frn);
  const endpoint = process.env.FCA_FIRM_LOOKUP_URL?.trim().replace(/\/+$/, "");

  if (!endpoint) {
    return (
      (await getSeedFallback(parsed.name)) ?? {
        available: false,
        queriedName: parsed.name,
        frn: resolvedFrn ?? null,
        authorised: null,
        warning: null,
        statusText: null,
        source: "FCA lookup not configured",
        note: "Set FCA_FIRM_LOOKUP_URL to enable live regulation checks.",
      }
    );
  }

  if (resolvedFrn) {
    try {
      const detailsPayload = await fetchFcaPayload(`${endpoint}/Firm/${resolvedFrn}/`);
      const parsedPayload = parseFirmDetailsPayload(detailsPayload, parsed.name, resolvedFrn);

      if (parsedPayload) {
        try {
          const regulatorsPayload = await fetchFcaPayload(
            `${endpoint}/Firm/${resolvedFrn}/Regulators/`,
          );
          const regulators = parseRegulatorsPayload(regulatorsPayload);
          if (regulators.length > 0) {
            parsedPayload.note = [parsedPayload.note, `Regulators: ${regulators.join(", ")}`]
              .filter((value): value is string => Boolean(value))
              .join(" | ");
          }
        } catch {
          // Keep the main firm-details result even if regulators enrichment fails.
        }

        return parsedPayload;
      }
    } catch {
      // Fall back to name search below.
    }
  }

  // No FRN or FRN lookup failed — try name-based search
  const nameResult = await searchFcaByName(parsed.name);
  if (nameResult) {
    return nameResult;
  }

  return (
      (await getSeedFallback(parsed.name)) ?? {
        available: false,
        queriedName: parsed.name,
        frn: resolvedFrn ?? null,
        authorised: null,
        warning: null,
        statusText: null,
        source: "FCA fallback",
      note: "Live FCA lookup failed and no reviewed fallback was found.",
    }
  );
}
