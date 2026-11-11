import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { RecipeDto } from "./recipe.dto";

@Controller("recipes")
export class RecipesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.recipe.findMany({
      where: { isPublished: true },
      orderBy: { title: "asc" },
      include: { ingredients: { include: { ingredient: true } } },
    });
  }

  @Get("community")
  community() { return this.prisma.recipe.findMany({ where: { isShared: true, isPublished: false }, include: { ingredients: { include: { ingredient: true } }, author: { select: { id: true, name: true } } }, orderBy: { updatedAt: "desc" } }); }

  @Get("mine")
  @UseGuards(JwtAuthGuard)
  mine(@Req() request: AuthenticatedRequest) {
    return this.prisma.recipe.findMany({
      where: { authorId: request.user.id }, orderBy: { updatedAt: "desc" },
      include: { ingredients: { include: { ingredient: true } } },
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Req() request: AuthenticatedRequest, @Body() dto: RecipeDto) {
    await this.validatePublication(request.user.id, dto);
    await this.validateIngredients(dto);
    const { ingredients, ...data } = dto;
    return this.prisma.recipe.create({
      data: { ...data, authorId: request.user.id, isPublished: dto.isPublished ?? false, ingredients: { create: ingredients } },
      include: { ingredients: { include: { ingredient: true } } },
    });
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard)
  async update(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() dto: RecipeDto) {
    await this.validatePublication(request.user.id, dto);
    await this.validateIngredients(dto);
    const { ingredients, ...data } = dto;
    return this.prisma.$transaction(async tx => {
      const owned = await tx.recipe.findFirst({ where: { id, authorId: request.user.id }, select: { id: true, isPublished: true, imageUrl: true } });
      if (!owned) throw new NotFoundException("Власний рецепт не знайдено");
      if (owned.isPublished) {
        const author = await tx.user.findUnique({ where: { id: request.user.id }, select: { role: true } });
        if (author?.role !== "MODERATOR") throw new ForbiddenException("Офіційні рецепти може змінювати лише модератор");
        if (dto.isPublished !== false && !(dto.imageUrl === undefined ? owned.imageUrl : dto.imageUrl)) {
          throw new BadRequestException("Для офіційного рецепта потрібне фото");
        }
      }
      return tx.recipe.update({
        where: { id, authorId: request.user.id },
        data: { ...data, ingredients: { deleteMany: {}, create: ingredients } },
        include: { ingredients: { include: { ingredient: true } } },
      });
    });
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  async remove(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    const result = await this.prisma.recipe.deleteMany({ where: { id, authorId: request.user.id } });
    if (!result.count) throw new NotFoundException("Власний рецепт не знайдено");
    return { deleted: true };
  }

  private async validateIngredients(dto: RecipeDto) {
    const ids = dto.ingredients.map(item => item.ingredientId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException("Інгредієнти не повинні повторюватися");
    const count = await this.prisma.ingredient.count({ where: { id: { in: ids } } });
    if (count !== ids.length) throw new BadRequestException("Один з інгредієнтів не знайдено");
  }

  private async validatePublication(userId: string, dto: RecipeDto) {
    if (dto.isPublished) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
      if (user?.role !== "MODERATOR") throw new ForbiddenException("Публікувати офіційні рецепти може лише модератор");
      if (!dto.imageUrl) throw new BadRequestException("Додайте фото перед публікацією рецепта");
    }
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  async detail(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    const recipe = await this.prisma.recipe.findFirst({
      where: { id, OR: [{ isPublished: true }, { isShared: true }, { authorId: request.user.id }] },
      include: { ingredients: { include: { ingredient: true } } },
    });
    if (!recipe) throw new NotFoundException("Рецепт не знайдено");
    return recipe;
  }
}
