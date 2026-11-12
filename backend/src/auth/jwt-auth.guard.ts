import {Reflector} from '@nestjs/core';
import {PrismaService} from '../prisma/prisma.service';
import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";

export const PublicRead=()=>SetMetadata('cookbook:public-read',true);

export type AuthenticatedRequest = Request & {
  user: { id: string; email: string; role: string };
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly config: ConfigService,private readonly prisma:PrismaService,private readonly reflector:Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if(!request.headers.authorization&&request.method==='GET'&&this.reflector.get<boolean>('cookbook:public-read',context.getHandler())){request.user={id:'',email:'',role:'GUEST'};return true;}
    const [scheme, token] = request.headers.authorization?.split(" ") ?? [];
    if (scheme !== "Bearer" || !token) throw new UnauthorizedException("Потрібна авторизація");
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; email: string; role: string;ver?:number }>(token, {
        secret: this.config.getOrThrow<string>("JWT_SECRET"),
      });
      if (!payload.sub || !payload.email || !payload.role) throw new Error("Malformed token");
      const user=await this.prisma.user.findUnique({where:{id:payload.sub},select:{id:true,email:true,role:true,deletedAt:true,authVersion:true}});
      if(!user||user.deletedAt||(payload.ver??0)!==user.authVersion)throw new Error('Account inactive or session revoked');
      request.user = { id: user.id, email: user.email, role: user.role };
      return true;
    } catch {
      throw new UnauthorizedException("Токен недійсний або прострочений");
    }
  }
}
