const KIT_API_BASE_URL = "https://api.kit.com/v4";

type KitSubscriberInput = {
  email: string;
  displayName?: string | null;
  referrer?: string | null;
};

type KitSubscriberResponse = {
  subscriber?: {
    id?: number;
    email_address?: string;
  };
};

function readOptionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function readPositiveIntegerEnv(name: string): number | null {
  const value = readOptionalEnv(name);
  if (!value) return null;

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function getKitApiKey(): string | null {
  return readOptionalEnv("KIT_API_KEY");
}

function getKitSignupFormId(): number | null {
  return readPositiveIntegerEnv("KIT_SIGNUP_FORM_ID");
}

function getKitFreeSignupTagId(): number | null {
  return readPositiveIntegerEnv("KIT_FREE_SIGNUP_TAG_ID");
}

function getKitPaidMemberTagId(): number | null {
  return readPositiveIntegerEnv("KIT_PAID_MEMBER_TAG_ID");
}

function normalizeEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  return normalized ? normalized : null;
}

function readFirstName(displayName?: string | null): string | null {
  const normalized = displayName?.trim();
  if (!normalized) return null;

  return normalized.split(/\s+/)[0] ?? normalized;
}

async function kitRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const apiKey = getKitApiKey();
  if (!apiKey) {
    throw new Error("Missing KIT_API_KEY.");
  }

  const response = await fetch(`${KIT_API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Kit-Api-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => "");
    throw new Error(
      `Kit request failed with ${response.status}${responseBody ? `: ${responseBody}` : ""}`,
    );
  }

  return (await response.json()) as T;
}

async function createOrUpdateSubscriber({
  email,
  displayName,
}: KitSubscriberInput): Promise<KitSubscriberResponse> {
  const firstName = readFirstName(displayName);
  return kitRequest<KitSubscriberResponse>("/subscribers", {
    email_address: email,
    ...(firstName && { first_name: firstName }),
  });
}

async function addSubscriberToForm(email: string, formId: number, referrer?: string | null) {
  await kitRequest<KitSubscriberResponse>(`/forms/${formId}/subscribers`, {
    email_address: email,
    ...(referrer?.trim() && { referrer: referrer.trim() }),
  });
}

async function tagSubscriberByEmail(email: string, tagId: number) {
  await kitRequest<KitSubscriberResponse>(`/tags/${tagId}/subscribers`, {
    email_address: email,
  });
}

export function isKitSignupConfigured(): boolean {
  return Boolean(getKitApiKey() && getKitSignupFormId());
}

export async function subscribeSignupToKit(input: KitSubscriberInput): Promise<void> {
  const email = normalizeEmail(input.email);
  const signupFormId = getKitSignupFormId();
  if (!email || !signupFormId || !getKitApiKey()) {
    return;
  }

  await createOrUpdateSubscriber({
    ...input,
    email,
  });
  await addSubscriberToForm(email, signupFormId, input.referrer);

  const freeSignupTagId = getKitFreeSignupTagId();
  if (freeSignupTagId) {
    await tagSubscriberByEmail(email, freeSignupTagId);
  }
}

export async function tagPaidMemberInKit(input: KitSubscriberInput): Promise<void> {
  const email = normalizeEmail(input.email);
  const paidMemberTagId = getKitPaidMemberTagId();
  if (!email || !paidMemberTagId || !getKitApiKey()) {
    return;
  }

  await createOrUpdateSubscriber({
    ...input,
    email,
  });
  await tagSubscriberByEmail(email, paidMemberTagId);
}
