// Prisma client setup — will be configured when PostgreSQL is connected
// Prisma v7 requires a database adapter (e.g., @prisma/adapter-pg)
// For now, this is a placeholder that will be wired up in Phase 2

// import { PrismaClient } from "@/generated/prisma/client";
// import { PrismaPg } from "@prisma/adapter-pg";
//
// const globalForPrisma = globalThis as unknown as {
//   prisma: PrismaClient | undefined;
// };
//
// export const prisma = globalForPrisma.prisma ?? new PrismaClient({
//   adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
// });
//
// if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export {};
