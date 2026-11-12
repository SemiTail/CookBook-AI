import {publicRecipeFilter} from './management.service';
import { BadRequestException, Controller, Delete, Get, NotFoundException, Param, Put, Req, UseGuards } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard, PublicRead, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
@Controller("library")
@UseGuards(JwtAuthGuard)
export class LibraryController {
 constructor(private readonly prisma:PrismaService) {}
 @Get("saved")
 saved(@Req() req:AuthenticatedRequest) { return this.prisma.recipe.findMany({where:{favorites:{some:{userId:req.user.id}},OR:[{authorId:req.user.id},{...publicRecipeFilter,OR:[{isPublished:true},{isShared:true}]}]},include:{ingredients:{include:{ingredient:true}}},orderBy:{updatedAt:"desc"}}); }
 @Get("ratings")
 @PublicRead()
 async ratings(){const rows=await this.prisma.rating.groupBy({by:["recipeId"],_avg:{value:true},_count:true,where:{recipe:{...publicRecipeFilter,OR:[{isPublished:true},{isShared:true}]}}});return rows.map(r=>({id:r.recipeId,average:r._avg.value,count:r._count}));}
 @Get("following")
 async following(@Req() req:AuthenticatedRequest) {
  const users=await this.prisma.follow.findMany({where:{followerId:req.user.id},select:{following:{select:{id:true,name:true,deletedAt:true,profile:{select:{avatarUrl:true,showRecipes:true}}}}}});
  const ids=users.map(x=>x.following.id);
  const recipes=await this.prisma.recipe.findMany({where:{authorId:{in:ids},...publicRecipeFilter,OR:[{isPublished:true},{isShared:true}]},include:{ingredients:{include:{ingredient:true}},author:{select:{id:true,name:true,deletedAt:true,profile:{select:{avatarUrl:true}}}}},orderBy:{publishedAt:"desc"}});
  return {users:users.map(x=>x.following),recipes};
 }
 @Get("follow/:id")
 async state(@Param("id") id:string,@Req() req:AuthenticatedRequest){return {following:!!await this.prisma.follow.findUnique({where:{followerId_followingId:{followerId:req.user.id,followingId:id}}})};}
 @Put("follow/:id")
 async follow(@Param("id") id:string,@Req() req:AuthenticatedRequest){
  if(id===req.user.id)throw new BadRequestException("Не можна відстежувати себе");
  if(!await this.prisma.user.findUnique({where:{id},select:{id:true}}))throw new NotFoundException("Користувача не знайдено");
  await this.prisma.follow.upsert({where:{followerId_followingId:{followerId:req.user.id,followingId:id}},create:{followerId:req.user.id,followingId:id},update:{}});
  return {following:true};
 }
 @Delete("follow/:id")
 async unfollow(@Param("id") id:string,@Req() req:AuthenticatedRequest){await this.prisma.follow.deleteMany({where:{followerId:req.user.id,followingId:id}});return {following:false};}
}
