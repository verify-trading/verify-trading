type LogLevel = "info" | "warn" | "error";

type LogMeta = Record<string, unknown> | undefined;

function serializeMeta(meta: LogMeta) {
  if (!meta) {
    return undefined;
  }

  try {
    return JSON.parse(JSON.stringify(meta));
  } catch {
    return { metaSerializationFailed: true };
  }
}

function write(level: LogLevel, message: string, meta?: LogMeta) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(meta ? { meta: serializeMeta(meta) } : {}),
  };
  const serializedPayload = JSON.stringify(payload);

  switch (level) {
    case "info":
      console.info(serializedPayload);
      break;
    case "warn":
      console.warn(serializedPayload);
      break;
    case "error":
      console.error(serializedPayload);
      break;
  }
}

export const logger = {
  info(message: string, meta?: LogMeta) {
    write("info", message, meta);
  },
  warn(message: string, meta?: LogMeta) {
    write("warn", message, meta);
  },
  error(message: string, meta?: LogMeta) {
    write("error", message, meta);
  },
};
