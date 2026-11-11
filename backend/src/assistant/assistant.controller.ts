import { Body, Controller, Delete, Get, Post, Req, UseGuards } from "@nestjs/common";
import { Transform } from "class-transformer";
import { IsString, MaxLength, MinLength } from "class-validator";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { AssistantService } from "./assistant.service";

class MessageDto {
  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsString() @MinLength(1) @MaxLength(4000)
  message!: string;
}

@Controller("assistant")
@UseGuards(JwtAuthGuard)
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}
  @Get("history") history(@Req() req: AuthenticatedRequest) { return this.assistant.history(req.user.id); }
  @Post("messages") send(@Req() req: AuthenticatedRequest, @Body() dto: MessageDto) { return this.assistant.send(req.user.id, dto.message); }
  @Delete("history") clear(@Req() req: AuthenticatedRequest) { return this.assistant.clear(req.user.id); }
}
