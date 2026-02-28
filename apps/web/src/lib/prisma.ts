/**
 * Prisma Client Singleton for Next.js
 *
 * Prevents connection pool exhaustion during hot-reload in development.
 * In production, a single PrismaClient instance is created and reused.
 *
 * @see https://www.prisma.io/docs/orm/more/help-and-troubleshooting/nextjs
 */

import { PrismaClient } from "@prisma/client";

const prismaClientSingleton = () => {
  return new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = prisma;

