import { Prisma, PrismaClient } from "@prisma/client";
import { AsyncLocalStorage } from "async_hooks";

const prisma = new PrismaClient({
  log: ["query", "info", "warn", "error"],
});

const asyncLocalStorage = new AsyncLocalStorage<{
  tx: Prisma.TransactionClient | null;
  rollback: (reason?: any) => void;
  commit: (value: void | PromiseLike<void>) => void;
}>();

const xPrisma = prisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query, model, operation }) {
        const als = asyncLocalStorage.getStore();
        if (als?.tx) {
          const client = als.tx as any;
          return client[model][operation](args);
        }
        return query(args);
      },
    },
  },
  client: {
    // TODO: savepointを使ってネストしたトランザクションを実現する
    async $begin() {
      console.debug(`transaction begin`);
      const als = asyncLocalStorage.getStore();
      const isInTransaction = !!als?.tx;

      if (isInTransaction) {
        return;
      }

      const prismaCleint = Prisma.getExtensionContext(prisma);

      return new Promise<void>((resolve, reject) => {
        return prismaCleint
          .$transaction(async (tx) => {
            await new Promise((innerResolve, innerReject) => {
              asyncLocalStorage.enterWith({
                tx: tx,
                rollback: innerReject,
                commit: innerResolve,
              });
              resolve();
            })
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

const transaction = async (isSuccess?: boolean) => {
  await xPrisma.$begin();
  await Promise.all(
    Array.from({ length: 100 }, (_, i) =>
      xPrisma.user.create({
        data: {
          email: ``,
          lastName: ``,
          firstName: ``,
        },
      })
    )
  );
  if (!isSuccess) throw new Error("rollback!");
};

export async function main(success: boolean) {
  try {
    await xPrisma.$begin();
    await transaction(success);
    await xPrisma.$commit();
  } catch (e) {
    await xPrisma.$rollback(e);
  };
}

main(false);
