/** A trimmed env var, or null when unset or blank. */
export function readOptionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}
