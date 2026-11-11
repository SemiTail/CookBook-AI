import { Controller, Get, NotFoundException, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";

@Controller("users")
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@Req() request: AuthenticatedRequest) {
    const user = await this.prisma.user.findUnique({
      where: { id: request.user.id },
      select: { id: true, name: true, email: true, role: true, createdAt: true, profile: true },
    });
    if (!user) throw new NotFoundException("Користувача не знайдено");
    return user;
  }
}
