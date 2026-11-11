import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
// This is the existing Prisma 7 generated client. Do NOT import from @prisma/client.
import { PrismaClient } from "../../generated/prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>("DATABASE_URL");
    if (!url.startsWith("file:")) {
      throw new Error("CookBook AI expects SQLite DATABASE_URL=file:./dev.db");
    }
    super({ adapter: new PrismaBetterSqlite3({ url }) });
  }
  async onModuleInit(): Promise<void> {
    await this.$connect();
    await this.$queryRaw`SELECT 1`;
    console.log("Database connected successfully");
  }
  async onModuleDestroy(): Promise<void> { await this.$disconnect(); }
}
