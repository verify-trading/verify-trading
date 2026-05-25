type UserMetadata = Record<string, unknown> | null | undefined;

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function readUserDisplayName(metadata: UserMetadata): string | null {
  const meta = metadata ?? {};
  return readNonEmptyString(meta.full_name) ?? readNonEmptyString(meta.name);
}
