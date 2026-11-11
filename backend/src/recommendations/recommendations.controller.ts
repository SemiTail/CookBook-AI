import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";
import { ingredientMatch } from "./match";

@Controller("recommendations")
@UseGuards(JwtAuthGuard)
export class RecommendationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    const owned = await this.prisma.fridgeItem.findMany({
      where: { userId: request.user.id }, select: { ingredientId: true },
    });
    const ownedIds = new Set(owned.map(item => item.ingredientId));
    const recipes = await this.prisma.recipe.findMany({
      where: { OR: [{ isPublished: true }, { isShared: true }, { authorId: request.user.id }] },
      include: { ingredients: { include: { ingredient: true } } },
    });
    // Required ingredients only; optional spices do not affect availability percentage.
    return recipes.flatMap(recipe => {
      const { matchPercent, eligible, missingIds } = ingredientMatch(recipe.ingredients, ownedIds);
      if (!eligible) return [];
      return [{
        ...recipe,
        matchPercent,
        missingIngredients: recipe.ingredients.filter(item => missingIds.includes(item.ingredientId))
          .map(item => ({ id: item.ingredientId, name: item.ingredient.name })),
      }];
    })
      .sort((a, b) => b.matchPercent - a.matchPercent || a.preparationMinutes - b.preparationMinutes);
  }
}
