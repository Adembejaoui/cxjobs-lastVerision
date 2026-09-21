import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

const pinoInstance: pino.Logger = isProduction
  ? pino({
      level: process.env.LOG_LEVEL || "info",
      base: { pid: process.pid },
    })
  : pino({
      level: process.env.LOG_LEVEL || "debug",
      base: { pid: process.pid },
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
