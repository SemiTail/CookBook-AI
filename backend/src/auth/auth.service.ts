import {randomBytes} from "node:crypto";
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
        data: { name: dto.name.trim(), handle:(dto.name.normalize('NFKC').toLocaleLowerCase('uk').replace(/[^\p{L}\p{N}_]+/gu,'_').replace(/^_+|_+$/g,'').slice(0,22)||'cook')+'_'+randomBytes(3).toString('hex'), email, passwordHash: await argon2.hash(dto.password), profile: { create: {} } },
        select: { id: true, name: true, handle:true, email: true, role: true },
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
    if (!user || user.deletedAt || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException("Неправильний email або пароль");
    }
    const safeUser = { id: user.id, name: user.name, handle:user.handle, email: user.email, role: user.role };
    return { accessToken: await this.issueToken({...safeUser,authVersion:user.authVersion}), user: safeUser };
  }

  private issueToken(user: { id: string; email: string; role: string;authVersion?:number }) {
    return this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role,ver:user.authVersion??0 });
  }
}
