import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";

async function main() {
  const [email, role = "MODERATOR"] = process.argv.slice(2);
  if (!email || !["USER", "MODERATOR"].includes(role)) throw new Error("Usage: npm run user:role -- email@example.com [MODERATOR|USER]");
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("file:")) throw new Error("Configure DATABASE_URL in backend/.env first");
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
  try {
    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true } });
    if (!user) throw new Error("User not found. Register this account in the application first.");
    await prisma.user.update({ where: { id: user.id }, data: { role: role as "USER" | "MODERATOR" } });
    console.log(`Role set to ${role}. Sign out and sign in again to refresh the interface.`);
  } finally { await prisma.$disconnect(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Role update failed"); process.exitCode = 1; });
