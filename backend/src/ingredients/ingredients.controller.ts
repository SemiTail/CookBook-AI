import { BadRequestException, Body, ConflictException, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { Transform } from "class-transformer";
import { IsString, Length, IsOptional, MaxLength, Matches } from "class-validator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";

const categories = ["Овочі", "Фрукти", "Ягоди", "Бобові", "Спеції", "Зелень", "Гриби", "Крупи", "Макаронні вироби", "М'ясо", "Риба та морепродукти", "Яйця", "Молочні продукти", "Горіхи та насіння", "Олії", "Консерви", "Інше"];
class CreateIngredientDto {
  @Transform(({ value }) => typeof value === "string" ? value.normalize("NFKC").trim().replace(/\s+/g, " ") : value)
  @IsString()
  @Length(2, 100)
  name!: string;

  @IsOptional() @IsString() @MaxLength(32)
  @Matches(/^\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*$/u)
  emoji?: string;

  @IsString() @Length(2, 80)
  category!: string;
}

class CategoryDto {
 @Transform(({ value }) => typeof value === "string" ? value.normalize("NFKC").trim().replace(/\s+/g, " ") : value)
 @IsString() @Length(2,80) name!: string;
}

@Controller("ingredients")
export class IngredientsController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  list() {
    return this.prisma.ingredient.findMany({ orderBy: { name: "asc" } });
  }

  @Get("categories")
  async categories() { return [...new Set([...categories, ...(await this.prisma.category.findMany()).map(x => x.name)])].sort((a,b) => a.localeCompare(b,"uk")); }
  @Post("categories")
  @UseGuards(JwtAuthGuard)
  async addCategory(@Body() dto: CategoryDto) {
    if ((await this.categories()).some(name => name.toLocaleLowerCase("uk") === dto.name.toLocaleLowerCase("uk"))) throw new ConflictException("Така категорія вже існує");
    try { return await this.prisma.category.create({ data: dto }); }
    catch { throw new ConflictException("Така категорія вже існує"); }
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreateIngredientDto) {
    if (!(await this.categories()).includes(dto.category)) throw new BadRequestException("Оберіть наявну категорію або створіть нову");
    const existing = await this.prisma.ingredient.findMany({ select: { name: true } });
    if (existing.some(item => item.name.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("uk") === dto.name.toLocaleLowerCase("uk"))) {
      throw new ConflictException("Такий інгредієнт уже є в каталозі. Оберіть його зі списку.");
    }
    try { return await this.prisma.ingredient.create({ data: dto }); }
    catch (error) {
      if ((error as { code?: string }).code === "P2002") throw new ConflictException("Такий інгредієнт уже є в каталозі.");
      throw error;
    }
  }
}
