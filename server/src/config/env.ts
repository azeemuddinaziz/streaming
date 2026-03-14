import "@dotenvx/dotenvx/config";
import { AppError } from "../utils/appError";

const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new AppError(`FATAL: ${key} is not defined in .env file`, 500);
  }
  return value;
};

export const ENV = {
  PORT: process.env.PORT || "3000",
  NODE_ENV: process.env.NODE_ENV || "development",
  SERVICE_VERSION: getEnv("SERVICE_VERSION"),
  SERVICE_NAME: getEnv("SERVICE_NAME"),
  DATABASE_URL: getEnv("DATABASE_URL"),
  JWT_SECRET: getEnv("JWT_SECRET"),
} as const;
