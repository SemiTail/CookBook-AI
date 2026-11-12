import {ManagementService,publicRecipeFilter} from '../users/management.service';
import { calculateNutrition } from "./nutrition";
import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard, PublicRead, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { RecipeDto } from "./recipe.dto";

function recipeAudit(r:any){return {...r,ingredients:r.ingredients?.map((i:any)=>({name:i.ingredient?.name??i.ingredientId,quantity:i.quantity,unit:i.unit,optional:i.optional}))};}
@Controller("recipes")
export class RecipesController {
  constructor(private readonly prisma: PrismaService, private readonly access:ManagementService) {}

  @Get()
  list() {
    return this.prisma.recipe.findMany({
      where: { isPublished: true, ...publicRecipeFilter },
      orderBy: { title: "asc" },
      include: { ingredients: { include: { ingredient: true } } },
    });
  }

  @Get("community")
  community() { return this.prisma.recipe.findMany({ where: { isShared: true, isPublished: false, ...publicRecipeFilter }, include: { ingredients: { include: { ingredient: true } }, author: { select: { id: true, name: true } } }, orderBy: { updatedAt: "desc" } }); }

  @Get("authors")
  @UseGuards(JwtAuthGuard)
  async authors(@Req() request:AuthenticatedRequest) {
    if(!await this.isModerator(request.user.id))throw new ForbiddenException("Потрібні права модератора");
    return this.prisma.user.findMany({select:{id:true,name:true,deletedAt:true,profileHiddenAt:true,profile:{select:{avatarUrl:true}}},orderBy:{name:"asc"}});
  }
  private async validateAuthor(userId:string,authorId?:string) {
    if(authorId===undefined)return;
    if(!await this.isModerator(userId))throw new ForbiddenException("Змінювати авторство може лише модератор");
    if(!await this.prisma.user.findUnique({where:{id:authorId},select:{id:true}}))throw new BadRequestException("Автора не знайдено");
  }
  @Get("moderation")
  @UseGuards(JwtAuthGuard)
  async moderation(@Req() request:AuthenticatedRequest) {
    if (!await this.isModerator(request.user.id)) throw new ForbiddenException("Потрібні права модератора");
    return this.prisma.recipe.findMany({include:{ingredients:{include:{ingredient:true}},author:{select:{id:true,name:true,deletedAt:true,profileHiddenAt:true,profile:{select:{avatarUrl:true}}}}},orderBy:{updatedAt:"desc"}});
  }
  private async isModerator(id:string) { return (await this.prisma.user.findUnique({where:{id},select:{role:true}}))?.role==="MODERATOR"; }

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
    await this.validateAuthor(request.user.id,dto.authorId);
    await this.validatePublication(request.user.id, dto);
    await this.validateIngredients(dto);
    if(dto.nutritionAuto){try{Object.assign(dto,Object.fromEntries(Object.entries(calculateNutrition(dto.ingredients.map(x=>({...x,quantity:x.quantity===undefined?"":String(x.quantity),unit:x.unit??""})),await this.prisma.ingredient.findMany({where:{id:{in:dto.ingredients.map(x=>x.ingredientId)}}}),dto.servings)).map(([k,v])=>[k,Number(v)])));}catch(e){throw new BadRequestException((e as Error).message);}}
    const { ingredients, authorId, ...data } = dto;
    return this.prisma.$transaction(async tx=>{const result=await tx.recipe.create({
      data: { ...data, authorId: authorId ?? request.user.id, originalAuthorship:{create:{userId:authorId??request.user.id}}, publishedAt: dto.isShared || dto.isPublished ? new Date() : null, isPublished: dto.isPublished ?? false, ingredients: { create: ingredients } },
      include: { ingredients: { include: { ingredient: true } } },
    });await this.access.log(request.user.id,result.authorId,'recipe.create',result.id,result.title,{after:recipeAudit(result)},tx);return result;});
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard)
  async update(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() dto: RecipeDto) {
    await this.validateAuthor(request.user.id,dto.authorId);
    await this.validatePublication(request.user.id, dto);
    await this.validateIngredients(dto);
    if(dto.nutritionAuto){try{Object.assign(dto,Object.fromEntries(Object.entries(calculateNutrition(dto.ingredients.map(x=>({...x,quantity:x.quantity===undefined?"":String(x.quantity),unit:x.unit??""})),await this.prisma.ingredient.findMany({where:{id:{in:dto.ingredients.map(x=>x.ingredientId)}}}),dto.servings)).map(([k,v])=>[k,Number(v)])));}catch(e){throw new BadRequestException((e as Error).message);}}
    const current=await this.access.recipe(request.user.id,id);
    const permissions=await this.access.permissions(request.user.id,current.authorId);if(!permissions.editRecipes)throw new NotFoundException('Власний рецепт не знайдено');
    const moderator=permissions.moderator;
    if(!permissions.owner&&!moderator&&!permissions.hideRecipes&&dto.isShared!==undefined&&dto.isShared!==current.isShared)throw new ForbiddenException('Для зміни видимості потрібне право приховування страв');
    if(!moderator&&dto.isPublished!==undefined&&dto.isPublished!==current.isPublished)throw new ForbiddenException("Лише модератор може змінювати офіційний статус рецепта");
    const { ingredients, authorId, ...data } = dto;
    return this.prisma.$transaction(async tx => {
      const owned = await tx.recipe.findUnique({ where: { id }, include:{ingredients:{include:{ingredient:true}}} });
      if (!owned) throw new NotFoundException("Власний рецепт не знайдено");
      if (owned.isPublished && !moderator && permissions.owner) {
        const author = await tx.user.findUnique({ where: { id: request.user.id }, select: { role: true } });
        if (author?.role !== "MODERATOR") throw new ForbiddenException("Офіційні рецепти може змінювати лише модератор");
      }
      const result=await tx.recipe.update({
        where: { id },
        data: { ...data, originalAuthorship:{upsert:{create:{userId:owned.authorId},update:{}}}, ...(authorId ? {authorId} : {}), ...(!owned.publishedAt && ((dto.isShared ?? owned.isShared) || (dto.isPublished ?? owned.isPublished)) ? {publishedAt: new Date()} : {}), ingredients: { deleteMany: {}, create: ingredients } },
        include: { ingredients: { include: { ingredient: true } } },
      });
      await this.access.log(request.user.id,owned.authorId,'recipe.edit',id,result.title,{before:recipeAudit(owned),after:recipeAudit(result)},tx);return result;
    });
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  async remove(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    const recipe=await this.access.recipe(request.user.id,id);
    if(recipe.authorId!==request.user.id&&!await this.isModerator(request.user.id))throw new NotFoundException('Власний рецепт не знайдено');
    return this.prisma.$transaction(async tx=>{await tx.recipe.delete({where:{id}});await this.access.log(request.user.id,recipe.authorId,'recipe.delete',id,recipe.title,{before:recipe},tx);return {deleted:true};});
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
    }
  }

  @Get(":id")
 @PublicRead()
  @UseGuards(JwtAuthGuard)
  async detail(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    const moderator = await this.isModerator(request.user.id);
    const recipe = await this.prisma.recipe.findFirst({
      where: { id, ...await this.access.readable(request.user.id) },
      include: { ingredients: { include: { ingredient: true } }, author:{select:{id:true,name:true,deletedAt:true,profileHiddenAt:true,profile:{select:{avatarUrl:true}}}}, ...(moderator ? {originalAuthorship:{include:{user:{select:{id:true,name:true,deletedAt:true,profileHiddenAt:true,profile:{select:{avatarUrl:true}}}}}}} : {}) },
    });
    if (!recipe) throw new NotFoundException("Рецепт не знайдено");
    return {...recipe,permissions:await this.access.permissions(request.user.id,recipe.authorId)};
  }
}
