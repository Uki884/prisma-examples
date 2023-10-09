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

type Option = {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
};

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
    async $begin(options?: Option) {
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
            return await new Promise((innerResolve, innerReject) => {
              asyncLocalStorage.enterWith({
                tx: tx,
                rollback: innerReject,
                commit: innerResolve,
              });
              resolve();
            });
          }, options);
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

const transaction = async (func: () => Promise<void>) => {
  await xPrisma.$begin();
  try {
    await func();
    await xPrisma.$commit();
  } catch (e) {
    await xPrisma.$rollback(e);
  }
};

class UserService {
  constructor(private prisma: typeof xPrisma) {}

  async addUser() {
    return await this.prisma.user.create({
      data: {
        email: ``,
        lastName: ``,
        firstName: ``,
      },
    });
  }
}

class StudentService {
  constructor(private prisma: typeof xPrisma) {}
  async addStudent() {
    const result = await this.prisma.student.create({
      data: {
        email: ``,
        lastName: ``,
        firstName: ``,
      },
    });
    return result;
  }
}

export async function main() {
  await transaction(async () => {
    const userService = new UserService(xPrisma);
    const studentService = new StudentService(xPrisma);
    await userService.addUser();
    await studentService.addStudent();
  });
}

main();
