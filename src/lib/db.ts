import { PrismaClient } from "@prisma/client";
import { createLocalPrismaFallback, MODEL_NAMES } from "./local-db-fallback";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  localFallback: Record<string, any> | undefined;
  useFallback: boolean | undefined;
};

const rawPrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.ALO_PRISMA_LOG === "true" ? ["query"] : [],
  });

const localFallback = globalForPrisma.localFallback ?? createLocalPrismaFallback();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = rawPrisma;
  globalForPrisma.localFallback = localFallback;
}

function isEngineOrConnectionError(error: unknown): boolean {
  const msg = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return (
    msg.includes("PrismaClientInitializationError") ||
    msg.includes("PrismaClientKnownRequestError") ||
    msg.includes("Query engine") ||
    msg.includes("engine=none") ||
    msg.includes("Can't reach database server") ||
    msg.includes("Connection refused") ||
    msg.includes("Environment variable not found: DATABASE_URL") ||
    msg.includes("Authentication failed against database server") ||
    msg.includes("P1000") ||
    msg.includes("P1001") ||
    msg.includes("P1002") ||
    msg.includes("P1003") ||
    msg.includes("Invalid `prisma.")
  );
}

function shouldStartInFallback(): boolean {
  if (globalForPrisma.useFallback !== undefined) return globalForPrisma.useFallback;
  const url = process.env.DATABASE_URL?.trim() || "";
  if (!url || url.includes("REPLACE_WITH_NEW") || url.includes("user:placeholder@")) {
    globalForPrisma.useFallback = true;
    return true;
  }
  return false;
}

function wrapModelDelegate(modelName: string) {
  const prismaDelegate = (rawPrisma as unknown as Record<string, any>)[modelName];
  const fallbackDelegate = localFallback[modelName];

  return new Proxy(fallbackDelegate, {
    get(_target, prop: string) {
      return async (...args: any[]) => {
        if (!shouldStartInFallback() && prismaDelegate && typeof prismaDelegate[prop] === "function") {
          try {
            return await prismaDelegate[prop](...args);
          } catch (error) {
            if (isEngineOrConnectionError(error)) {
              globalForPrisma.useFallback = true;
            } else {
              throw error;
            }
          }
        }
        return fallbackDelegate[prop](...args);
      };
    },
  });
}

function createResilientDb(): PrismaClient {
  const delegates: Record<string, any> = {};
  for (const model of MODEL_NAMES) {
    delegates[model] = wrapModelDelegate(model);
  }

  return new Proxy(rawPrisma, {
    get(target, prop: string) {
      if (prop in delegates) {
        return delegates[prop];
      }
      if (prop === "$queryRaw") {
        return async (...args: any[]) => {
          if (!shouldStartInFallback()) {
            try {
              return await (target.$queryRaw as any)(...args);
            } catch (error) {
              if (isEngineOrConnectionError(error)) {
                globalForPrisma.useFallback = true;
              } else {
                throw error;
              }
            }
          }
          return localFallback.$queryRaw(...args);
        };
      }
      if (prop === "$transaction") {
        return async (fnOrArray: any, options?: any) => {
          if (!shouldStartInFallback()) {
            try {
              return await (target.$transaction as any)(fnOrArray, options);
            } catch (error) {
              if (isEngineOrConnectionError(error)) {
                globalForPrisma.useFallback = true;
              } else {
                throw error;
              }
            }
          }
          return localFallback.$transaction(fnOrArray);
        };
      }
      const val = (target as any)[prop];
      return typeof val === "function" ? val.bind(target) : val;
    },
  });
}

export const db: PrismaClient = createResilientDb();
