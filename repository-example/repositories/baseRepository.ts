import { Prisma, PrismaClient } from "@prisma/client";

export type BaseExtendedClientType = ReturnType<
  typeof BaseRepository["prototype"]["extendBasePrisma"]
>;

type UncapitalizedModelName = Uncapitalize<Prisma.ModelName>;

export abstract class BaseRepository<T> {
  constructor(
    protected readonly prismaClient: PrismaClient,
    protected readonly type: UncapitalizedModelName
  ) {}

  private _prisma: (T & BaseExtendedClientType) | undefined = undefined;

  protected provideExtended(extendedPrisma: (client: any) => any) {
    const base = this.extendBasePrisma();
    const extendedPrismaClient = extendedPrisma(base) as T &
      BaseExtendedClientType;
    this._prisma = extendedPrismaClient;
    return extendedPrismaClient;
  }

  execute(prisma?: Prisma.TransactionClient) {
    if (prisma) {
      return prisma[this.type] as T;
    }
    return this._prisma![this.type] as T;
  }

  private extendBasePrisma() {
    return this.prismaClient.$extends({});
  }

  // $transactionを返すときにthisがグローバルオブジェクトを指すようになるため、bindしている
  public get getTransaction(): BaseExtendedClientType["$transaction"] {
    return this._prisma!.$transaction.bind(this._prisma);
  }
}
