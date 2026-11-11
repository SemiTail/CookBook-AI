import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";

export type AuthenticatedRequest = Request & {
  user: { id: string; email: string; role: string };
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(" ") ?? [];
    if (scheme !== "Bearer" || !token) throw new UnauthorizedException("Потрібна авторизація");
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; email: string; role: string }>(token, {
        secret: this.config.getOrThrow<string>("JWT_SECRET"),
      });
      if (!payload.sub || !payload.email || !payload.role) throw new Error("Malformed token");
      request.user = { id: payload.sub, email: payload.email, role: payload.role };
      return true;
    } catch {
      throw new UnauthorizedException("Токен недійсний або прострочений");
    }
  }
}
