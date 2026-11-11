import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";
import { AddFridgeItemDto } from "./dto/add-fridge-item.dto";
import { BulkFridgeDto, RemoveFridgeItemsDto } from "./dto/bulk-fridge.dto";

@Controller("fridge")
@UseGuards(JwtAuthGuard)
export class FridgeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.prisma.fridgeItem.findMany({
      where: { userId: request.user.id },
      include: { ingredient: true },
      orderBy: { ingredient: { name: "asc" } },
    });
  }

  @Post()
  async add(@Req() request: AuthenticatedRequest, @Body() dto: AddFridgeItemDto) {
    const ingredient = await this.prisma.ingredient.findUnique({ where: { id: dto.ingredientId } });
    if (!ingredient) throw new NotFoundException("Інгредієнт не знайдено");
    return this.prisma.fridgeItem.upsert({
      where: { userId_ingredientId: { userId: request.user.id, ingredientId: dto.ingredientId } },
      update: { quantity: dto.quantity, unit: dto.unit },
      create: { userId: request.user.id, ingredientId: dto.ingredientId, quantity: dto.quantity, unit: dto.unit },
      include: { ingredient: true },
    });
  }

  @Post("bulk")
  async addBulk(@Req() request: AuthenticatedRequest, @Body() dto: BulkFridgeDto) {
    const count = await this.prisma.ingredient.count({ where: { id: { in: dto.ingredientIds } } });
    if (count !== dto.ingredientIds.length) throw new BadRequestException("Один з продуктів не знайдено");
    await this.prisma.$transaction(dto.ingredientIds.map(ingredientId => this.prisma.fridgeItem.upsert({
      where: { userId_ingredientId: { userId: request.user.id, ingredientId } },
      update: {}, create: { userId: request.user.id, ingredientId },
    })));
    return this.list(request);
  }

  @Delete("selected")
  async removeSelected(@Req() request: AuthenticatedRequest, @Body() dto: RemoveFridgeItemsDto) {
    const result = await this.prisma.fridgeItem.deleteMany({ where: { userId: request.user.id, id: { in: dto.ids } } });
    return { deleted: result.count };
  }

  @Delete()
  async clear(@Req() request: AuthenticatedRequest) {
    const result = await this.prisma.fridgeItem.deleteMany({ where: { userId: request.user.id } });
    return { deleted: result.count };
  }

  @Delete(":id")
  async remove(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    const existing = await this.prisma.fridgeItem.findFirst({ where: { id, userId: request.user.id } });
    if (!existing) throw new NotFoundException("Продукт у холодильнику не знайдено");
    await this.prisma.fridgeItem.delete({ where: { id: existing.id } });
    return { deleted: true };
  }
}
