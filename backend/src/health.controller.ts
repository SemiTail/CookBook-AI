import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  async check() {
    const recipes = await this.prisma.recipe.count();
    return { status: "ok", database: "sqlite", recipes };
  }
}
