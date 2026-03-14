import { createLogger, format, transports } from "winston";
const { combine, timestamp, label, printf, colorize } = format;

const terminalFormat = printf(
  ({ level, message, timestamp, label, ...metadata }) => {
    const metaDataString = Object.keys(metadata).length
      ? `\n${JSON.stringify(metadata, null, 2)}`
      : "";

    return `${timestamp} [${label}] ${level}: ${message} ${metaDataString}`;
  },
);

const logger = createLogger({
  level: "info",
  format: combine(
    label({ label: "production" }),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.errors({ stack: true }),
    format.splat(),
    format.json(),
  ),
  transports: [
    new transports.File({ filename: "error.log", level: "error" }),
    new transports.File({ filename: "combined.log" }),
    new transports.Console({
      format: combine(colorize({ all: true }), terminalFormat),
    }),
  ],
});

export default logger;
