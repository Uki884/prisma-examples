import { UserRepository } from './repositories/userRepository';
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: ["query", "info", "warn", "error"],
});

export async function main() {
  const userRepository = new UserRepository(prisma);

  // computed-fields
  const example1 = await userRepository.execute().findFirst();
  console.log(example1?.fullName);

  // static methods
  const user1 = await userRepository
    .execute()
    .create({
      data: { firstName: "test", lastName: "test", email: "test@test.com" },
    });
  const example2 = await userRepository.execute().findFirstByEmail(user1.email);
  console.log(example2);

  // transaction
  await userRepository.getTransaction(async (prisma) => {
    await userRepository.execute(prisma).create({
      data: {
        email: "example@example.com",
        firstName: "firstName",
        lastName: "lastName",
      },
    });
    await userRepository.execute(prisma).create({
      data: {
        email: "example@example.com",
        firstName: "firstName",
        lastName: "lastName",
      },
    });
    throw new Error();
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
