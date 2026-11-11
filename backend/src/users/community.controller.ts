import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { Transform } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, IsUrl, Length, Max, Min } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
class CommentDto { @Transform(({value}) => typeof value === "string" ? value.trim() : value) @IsString() @Length(1,4000) text!: string; }
class RatingDto { @IsInt() @Min(1) @Max(5) value!: number; }
class ProfileDto {
 @Transform(({value}) => typeof value === "string" ? value.trim() : value) @IsString() @Length(2,80) name!: string;
 @IsString() @Length(0,4000) bio!: string;
 @IsOptional() @IsUrl({ protocols: ["http","https"], require_protocol: true }) avatarUrl?: string | null;
 @IsOptional() @IsUrl({ protocols: ["http","https"], require_protocol: true }) coverUrl?: string | null;
 @IsBoolean() showRecipes!: boolean;
}
@Controller()
@UseGuards(JwtAuthGuard)
export class CommunityController {
 constructor(private readonly prisma: PrismaService) {}
 private async visible(id: string, userId: string) {
   const recipe = await this.prisma.recipe.findFirst({ where: { id, OR: [{ isPublished: true }, { isShared: true }, { authorId: userId }] }, select: { id: true } });
   if (!recipe) throw new NotFoundException("Рецепт не знайдено");
 }
 @Get("recipes/:id/favorite")
 async favorite(@Param("id") id:string,@Req() req:AuthenticatedRequest) { await this.visible(id,req.user.id); return { saved: !!(await this.prisma.favorite.findUnique({where:{userId_recipeId:{userId:req.user.id,recipeId:id}}})) }; }
 @Put("recipes/:id/favorite")
 async saveFavorite(@Param("id") id:string,@Req() req:AuthenticatedRequest) { await this.visible(id,req.user.id); await this.prisma.favorite.upsert({where:{userId_recipeId:{userId:req.user.id,recipeId:id}},create:{userId:req.user.id,recipeId:id},update:{}});return {saved:true}; }
 @Delete("recipes/:id/favorite")
 async unsaveFavorite(@Param("id") id:string,@Req() req:AuthenticatedRequest) { await this.visible(id,req.user.id);await this.prisma.favorite.deleteMany({where:{userId:req.user.id,recipeId:id}});return {saved:false}; }
 @Get("recipes/:id/discussion")
 async discussion(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
   await this.visible(id, req.user.id);
   const [comments, ratings, mine] = await Promise.all([
     this.prisma.comment.findMany({ where: { recipeId: id }, orderBy: { createdAt: "asc" }, include: { user: { select: { id: true, name: true, profile: { select: { avatarUrl: true } } } } } }),
     this.prisma.rating.aggregate({ where: { recipeId: id }, _avg: { value: true }, _count: true }),
     this.prisma.rating.findUnique({ where: { userId_recipeId: { userId: req.user.id, recipeId: id } } })
   ]);
   return { comments, average: ratings._avg.value, count: ratings._count, mine: mine?.value ?? null };
 }
 @Post("recipes/:id/comments")
 async comment(@Param("id") id: string, @Req() req: AuthenticatedRequest, @Body() dto: CommentDto) {
   await this.visible(id, req.user.id);
   return this.prisma.comment.create({ data: { text: dto.text, recipeId: id, userId: req.user.id } });
 }
 @Delete("recipes/:id/comments/:commentId")
 async remove(@Param("id") id: string, @Param("commentId") commentId: string, @Req() req: AuthenticatedRequest) {
   await this.visible(id, req.user.id);
   const result = await this.prisma.comment.deleteMany({ where: { id: commentId, recipeId: id, userId: req.user.id } });
   if (!result.count) throw new NotFoundException("Коментар не знайдено");
   return { deleted: true };
 }
 @Put("recipes/:id/rating")
 async rate(@Param("id") id: string, @Req() req: AuthenticatedRequest, @Body() dto: RatingDto) {
   await this.visible(id, req.user.id);
   return this.prisma.rating.upsert({ where: { userId_recipeId: { userId: req.user.id, recipeId: id } }, create: { userId: req.user.id, recipeId: id, value: dto.value }, update: { value: dto.value } });
 }
 @Put("users/me/profile")
 async update(@Req() req: AuthenticatedRequest, @Body() dto: ProfileDto) {
   const { name, ...profile } = dto;
   return this.prisma.user.update({ where: { id: req.user.id }, data: { name, profile: { upsert: { create: profile, update: profile } } }, select: { id: true, name: true, profile: true } });
 }
 @Get("users/:id/profile")
 async profile(@Param("id") id: string) {
   const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, name: true, profile: true } });
   if (!user) throw new NotFoundException("Користувача не знайдено");
   const recipes = user.profile?.showRecipes ? await this.prisma.recipe.findMany({ where: { authorId: id, OR: [{ isShared: true }, { isPublished: true }] }, include: { ingredients: { include: { ingredient: true } } }, orderBy: { updatedAt: "desc" } }) : [];
   return { ...user, recipes };
 }
}
