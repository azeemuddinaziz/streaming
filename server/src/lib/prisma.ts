import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { ENV } from "../config/env";
import { PrismaClient } from "../generated/prisma";

const connectionString = `${ENV.DATABASE_URL}`;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export { prisma };
