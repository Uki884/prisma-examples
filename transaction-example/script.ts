import { Prisma, PrismaClient } from "@prisma/client";
import { AsyncLocalStorage } from "async_hooks";

const prisma = new PrismaClient({
  log: ["query", "info", "warn", "error"],
});

const asyncLocalStorage = new AsyncLocalStorage<{
  tx: Prisma.TransactionClient | null;
  rollback: any;
  commit: any;
}>();

const xPrisma = prisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query, model, operation }: any) {
        const als = asyncLocalStorage.getStore();
        if (als?.tx) {
          return (als as any).tx[model][operation](args);
        }
        return query(args);
      },
    },
  },
  client: {
    async $begin() {
      console.debug(`transaction begin`);
      return new Promise<void>((resolve, reject) => {
        const als = asyncLocalStorage.getStore();
        if (als) {
          resolve();
        }
        return prisma.$transaction(async (tx) => {
          await new Promise((innerResolve, innerReject) => {
            asyncLocalStorage.enterWith({
              tx: tx as any,
              rollback: innerReject,
              commit: innerResolve,
            });
            resolve();
          });
        });
      });
    },
    async $commit() {
      console.debug(`transaction committed`);
      const als = asyncLocalStorage.getStore();
      if (als?.commit) {
        als.commit();
      }
    },
    async $rollback(e: any) {
      console.debug(`transaction aborted`);
      const als = asyncLocalStorage.getStore();
      if (als?.rollback) {
        als.rollback(e);
      }
    },
  },
});

const createUsers = async (isSuccess?: boolean) => {
  await xPrisma.user.create({
    data: {
      email: "",
      lastName: "",
      firstName: "",
    },
  });
  if (!isSuccess) throw new Error("問題がおきました");
};
const transaction = async (isSuccess?: boolean) => {
  await xPrisma.$begin();
  try {
    await createUsers(isSuccess);
    await xPrisma.$commit();
  } catch (e) {
    await xPrisma.$rollback(e);
  }
};

export async function main() {
  await transaction(true);
  // await transaction(false);
}

main()
