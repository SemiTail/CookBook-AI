import { BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";

import { Transform } from "class-transformer";

import { IsString, Length, IsOptional, MaxLength, Matches, IsNumber, Min, Max, IsIn } from "class-validator";

import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";

import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";



const baselineCategories = ["Овочі", "Фрукти", "Ягоди", "Бобові", "Спеції", "Зелень", "Гриби", "Крупи", "Макаронні вироби", "М'ясо", "Риба та морепродукти", "Яйця", "Молочні продукти", "Горіхи та насіння", "Олії", "Консерви", "Інше"];

const isGeographicCategory = (value:string) => /азі[йя]|європ|африк|америк|океан|австрал|антаркт|середземномор|регіон|країн|япон|китай|корей|індій|тайськ|україн|італій|француз|мексик|кавказ|близько[ -]?схід|східно[ -]?азі/i.test(value);

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



class EditIngredientDto extends CreateIngredientDto {
 @IsIn(['exact','range','unknown','not_food']) nutritionMode!:string;
 @IsOptional() @IsNumber() @Min(0) @Max(1000) kcal?:number;
 @IsOptional() @IsNumber() @Min(0) @Max(100) protein?:number;
 @IsOptional() @IsNumber() @Min(0) @Max(100) fat?:number;
 @IsOptional() @IsNumber() @Min(0) @Max(100) carbs?:number;
 @IsOptional() @IsNumber() @Min(0) @Max(1000) kcalMin?:number;
 @IsOptional() @IsNumber() @Min(0) @Max(1000) kcalMax?:number;
 @IsOptional() @IsNumber() @Min(0) @Max(100) proteinMin?:number;
 @IsOptional() @IsNumber() @Min(0) @Max(100) proteinMax?:number;
 @IsOptional() @IsNumber() @Min(0) @Max(100) fatMin?:number;
 @IsOptional() @IsNumber() @Min(0) @Max(100) fatMax?:number;
 @IsOptional() @IsNumber() @Min(0) @Max(100) carbsMin?:number;
 @IsOptional() @IsNumber() @Min(0) @Max(100) carbsMax?:number;
 @IsOptional() @IsString() @MaxLength(1000) nutritionNote?:string;
 @IsOptional() @IsNumber() @Min(0.000001) @Max(1000000) gramsPerUnit?:number|null;
 @IsOptional() @IsNumber() @Min(0.000001) @Max(100) densityGramsPerMl?:number|null;
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

  async categories() { if(!(await this.prisma.category.count()))await this.prisma.category.createMany({data:baselineCategories.map(name=>({name}))}); return [...new Set([...(await this.prisma.category.findMany()).map(x => x.name)])].filter(name=>!isGeographicCategory(name)).sort((a,b) => a.localeCompare(b,"uk")); }

  @Post("categories")

  @UseGuards(JwtAuthGuard)

  async addCategory(@Req() request:AuthenticatedRequest,@Body() dto: CategoryDto) {

    await this.requireModerator(request.user.id);
    if (isGeographicCategory(dto.name)) throw new BadRequestException("Країни та регіони належать до регіональних фільтрів. Вкажіть категорію за типом продукту.");
    if ((await this.categories()).some(name => name.toLocaleLowerCase("uk") === dto.name.toLocaleLowerCase("uk"))) throw new ConflictException("Така категорія вже існує");

    try { return await this.prisma.category.create({ data: dto }); }

    catch { throw new ConflictException("Така категорія вже існує"); }

  }



  @Post()

  @UseGuards(JwtAuthGuard)

  async create(@Req() request:AuthenticatedRequest,@Body() dto: CreateIngredientDto) {

    await this.requireModerator(request.user.id);
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

  @Patch('categories/:name')
  @UseGuards(JwtAuthGuard)
  async renameCategory(@Req() request:AuthenticatedRequest,@Param('name') oldName:string,@Body() dto:CategoryDto){
   await this.requireModerator(request.user.id);
   if(isGeographicCategory(dto.name))throw new BadRequestException('Географія належить до регіональних фільтрів');
   if(!(await this.categories()).includes(oldName))throw new NotFoundException('Категорію не знайдено');
   if(oldName===dto.name)return {name:dto.name};
   if((await this.categories()).some(n=>n.toLocaleLowerCase('uk')===dto.name.toLocaleLowerCase('uk')))throw new ConflictException('Така категорія вже існує');
   return this.prisma.$transaction(async tx=>{
    await tx.category.create({data:{name:dto.name}});
    for(const item of await tx.ingredient.findMany()){
     const tags=Array.isArray(item.categoryTags)?item.categoryTags:[];
     if(item.category===oldName||tags.includes(oldName))await tx.ingredient.update({where:{id:item.id},data:{...(item.category===oldName?{category:dto.name}:{}),categoryTags:[...new Set(tags.map(v=>v===oldName?dto.name:v))]}});
    }
    await tx.category.deleteMany({where:{name:oldName}});return {name:dto.name};
   });
  }
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async edit(@Req() request:AuthenticatedRequest,@Param('id') id:string,@Body() dto:EditIngredientDto){
   await this.requireModerator(request.user.id);
   const old=await this.prisma.ingredient.findUnique({where:{id}});if(!old)throw new NotFoundException('Інгредієнт не знайдено');
   if(!(await this.categories()).includes(dto.category))throw new BadRequestException('Оберіть наявну категорію');
   if((await this.prisma.ingredient.findMany({select:{id:true,name:true}})).some(x=>x.id!==id&&x.name.toLocaleLowerCase('uk')===dto.name.toLocaleLowerCase('uk')))throw new ConflictException('Такий інгредієнт уже існує');
   const keys=['kcal','protein','fat','carbs'] as const;
   const d=dto as unknown as Record<string,unknown>;
   if(dto.nutritionMode==='exact'&&keys.some(k=>typeof d[k]!=='number'))throw new BadRequestException('Заповніть усі чотири показники КБЖВ');
   if(dto.nutritionMode==='range'&&keys.some(k=>typeof d[k+'Min']!=='number'||typeof d[k+'Max']!=='number'||Number(d[k+'Min'])>Number(d[k+'Max'])))throw new BadRequestException('Заповніть коректні межі усіх чотирьох діапазонів');
   const range=dto.nutritionMode==='range'?Object.fromEntries(keys.map(k=>[k,{min:d[k+'Min'],max:d[k+'Max']}])):null;
   const tags=Array.isArray(old.categoryTags)?old.categoryTags.filter(v=>v!==old.category&&v!=='Рослинні продукти'&&v!=='Тваринні продукти'):[];
   if(/молоч|м.яс|субпродукт|риб|морепродукт|яйця|комах/i.test(dto.category))tags.push('Тваринні продукти');
   if(/овоч|фрукт|ягод|зелень|гриб|бобов|круп|горіх|насіння|олії|сухофрукт|борошн|рослинн|пророст|водорост/i.test(dto.category))tags.push('Рослинні продукти');
   const exact=dto.nutritionMode==='exact';
   const oldRange=old.nutritionRange as Record<string,{min:number;max:number}>|null;
   const unchanged=exact?old.nutritionStatus==='verified'&&[old.caloriesPer100g,old.proteinPer100g,old.fatPer100g,old.carbsPer100g].every((v,i)=>v===d[keys[i]]):dto.nutritionMode==='range'?!!oldRange&&keys.every(k=>oldRange[k]?.min===d[k+'Min']&&oldRange[k]?.max===d[k+'Max']):dto.nutritionMode==='not_food'?old.nutritionStatus==='not_food':!oldRange&&old.nutritionStatus!=='verified'&&old.nutritionStatus!=='not_food';
   return this.prisma.ingredient.update({where:{id},data:{name:dto.name,category:dto.category,emoji:dto.emoji||null,categoryTags:[...new Set([dto.category,...tags])],
    gramsPerUnit:dto.gramsPerUnit??null,densityGramsPerMl:dto.densityGramsPerMl??null,
    caloriesPer100g:exact?dto.kcal:null,proteinPer100g:exact?dto.protein:null,fatPer100g:exact?dto.fat:null,carbsPer100g:exact?dto.carbs:null,
    nutritionStatus:exact?'verified':dto.nutritionMode==='not_food'?'not_food':'needs_review',nutritionUpdatedAt:new Date(),nutritionNote:dto.nutritionNote||null,
    nutritionSource:unchanged?old.nutritionSource:'Дані модератора',nutritionSourceUrl:unchanged?old.nutritionSourceUrl:null,nutritionSourceFood:unchanged?old.nutritionSourceFood:null,
    nutritionRange:unchanged&&old.nutritionRange?{...(old.nutritionRange as Prisma.InputJsonObject),note:dto.nutritionNote||''}:range?{...range,kind:'product',source:'Дані модератора',sourceUrl:'',note:dto.nutritionNote||'Діапазон продукту',sampleCount:0,sourceIds:[]}:Prisma.DbNull}});
  }

  private async requireModerator(id:string) {
    if((await this.prisma.user.findUnique({where:{id},select:{role:true}}))?.role!=="MODERATOR")throw new ForbiddenException("Каталогом продуктів і категорій керують модератори");
  }
  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  async remove(@Param("id") id:string,@Req() request:AuthenticatedRequest) {
    const user=await this.prisma.user.findUnique({where:{id:request.user.id},select:{role:true}});
    if(user?.role!=="MODERATOR")throw new ForbiddenException("Видаляти зі спільного каталогу може лише модератор");
    try {
      return await this.prisma.$transaction(async tx=>{
        const affected=await tx.recipeIngredient.findMany({where:{ingredientId:id},select:{recipeId:true}});
        const recipeLinks=await tx.recipeIngredient.deleteMany({where:{ingredientId:id}});
        const fridge=await tx.fridgeItem.deleteMany({where:{ingredientId:id}});
        const shopping=await tx.shoppingListItem.deleteMany({where:{ingredientId:id}});
        await tx.recipe.updateMany({where:{id:{in:affected.map(x=>x.recipeId)}},data:{calories:null,protein:null,fat:null,carbs:null}});
        await tx.ingredient.delete({where:{id}});
        return {deleted:true,affectedRecipes:recipeLinks.count,affectedFridges:fridge.count,affectedShoppingItems:shopping.count};
      });
    } catch(error) {
      const code=(error as {code?:string}).code;
      if(code==="P2025")throw new NotFoundException("Інгредієнт не знайдено");
      throw error;
    }
  }

}

