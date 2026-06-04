import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME ?? "admin";
  const email = process.env.ADMIN_EMAIL ?? "admin@colourdice.local";
  const password = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: Role.admin },
    create: {
      username,
      email,
      passwordHash,
      role: Role.admin,
    },
  });

  console.log(`✅ Seeded admin: ${admin.username} <${admin.email}> (id=${admin.id})`);
  if (!process.env.ADMIN_PASSWORD) {
    console.warn(
      "⚠️  Used the DEFAULT admin password. Set ADMIN_PASSWORD in apps/server/.env and rotate it.",
    );
  }
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
