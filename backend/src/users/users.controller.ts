import {ProfileCardService} from './profile-card.service';
import { Controller, Get, Query, NotFoundException, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, PublicRead, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";

@Controller("users")
export class UsersController {
  constructor(private readonly prisma: PrismaService,private readonly cards:ProfileCardService) {}

  @Get('profile-card')
  @UseGuards(JwtAuthGuard)
  @PublicRead()
  card(@Query('target') target:string){return this.cards.lookup(target);}

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@Req() request: AuthenticatedRequest) {
    const user = await this.prisma.user.findUnique({
      where: { id: request.user.id },
      select: { id: true, name: true, handle:true, deletedAt:true,profileHiddenAt:true,email: true, role: true, createdAt: true, profile: true },
    });
    if (!user) throw new NotFoundException("Користувача не знайдено");
    return user;
  }
}
