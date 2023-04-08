import { Prisma, PrismaClient } from "@prisma/client";
import {
  BaseRepository,
} from "./baseRepository";

export const userExtendedClient = Prisma.defineExtension((client) => {
  return client.$extends({
    result: {
      user: {
        fullName: {
          needs: { firstName: true, lastName: true },
          compute(user) {
            return `${user.firstName} ${user.lastName}`;
          },
        },
      },
    },
    model: {
      user: {
        async findFirstByEmail(email: string) {
          return client.user.findFirstOrThrow({
            where: {
              email,
            },
          });
        },
      },
    },
  });
});

export type UserExtendedClientType = ReturnType<typeof userExtendedClient>['user'];

export class UserRepository extends BaseRepository<
  UserExtendedClientType
> {

  constructor(protected readonly prismaClient: PrismaClient) {
    super(prismaClient, "user");
    this.provideExtended(userExtendedClient);
  }
}
