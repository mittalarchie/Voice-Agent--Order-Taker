import { PrismaClient } from "@prisma/client";

// Standard Next.js pattern: in dev, hot-reload would otherwise create a new
// PrismaClient (and new SQLite connection) on every file save. Stashing it
// on `globalThis` keeps a single instance alive across reloads.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
