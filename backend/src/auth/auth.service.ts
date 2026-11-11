import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new ConflictException("Ця електронна адреса вже використовується");
    }
    let user;
    try {
      user = await this.prisma.user.create({
        data: { name: dto.name.trim(), email, passwordHash: await argon2.hash(dto.password), profile: { create: {} } },
        select: { id: true, name: true, email: true, role: true },
      });
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
        throw new ConflictException("Ця електронна адреса вже використовується");
      }
      throw err;
    }
    return { accessToken: await this.issueToken(user), user };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.trim().toLowerCase() } });
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException("Неправильний email або пароль");
    }
    const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
    return { accessToken: await this.issueToken(safeUser), user: safeUser };
  }

  private issueToken(user: { id: string; email: string; role: string }) {
    return this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role });
  }
}
