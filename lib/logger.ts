import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Defence-in-depth redaction. Call sites must still avoid logging secrets,
 * but if a credential, token, cookie or raw request body slips into a log
 * object (top level or one level deep) it is censored before output.
 */
const SENSITIVE_KEYS = [
  "password",
  "passwordHash",
  "newPassword",
  "token",
  "tokenHash",
  "resetToken",
  "resetUrl",
  "verificationUrl",
  "accessToken",
  "refreshToken",
  "access_token",
  "refresh_token",
  "id_token",
  "secret",
  "apiKey",
  "authorization",
  "cookie",
  "cookies",
  "set-cookie",
  "body",
  "cvText",
  "fullText",
];

export const REDACT_PATHS = [
  ...SENSITIVE_KEYS.map((k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : `["${k}"]`)),
  ...SENSITIVE_KEYS.map((k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? `*.${k}` : `*["${k}"]`)),
  "headers.authorization",
  "headers.cookie",
  "req.headers.authorization",
  "req.headers.cookie",
];

const redact = { paths: REDACT_PATHS, censor: "[REDACTED]" };

const pinoInstance: pino.Logger = isProduction
  ? pino({
      level: process.env.LOG_LEVEL || "info",
      base: { pid: process.pid },
      redact,
    })
  : pino({
      level: process.env.LOG_LEVEL || "debug",
      base: { pid: process.pid },
      redact,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          ignore: "pid",
        },
      },
    });

export const logger = {
  info: (message: string, data?: unknown) => {
    pinoInstance.info(data ?? {}, message);
  },
  warn: (message: string, data?: unknown) => {
    pinoInstance.warn(data ?? {}, message);
  },
  error: (message: string, data?: unknown) => {
    pinoInstance.error(data ?? {}, message);
  },
  debug: (message: string, data?: unknown) => {
    pinoInstance.debug(data ?? {}, message);
  },
};
