import {publicRecipeFilter} from './management.service';
import {BadRequestException,Body,Controller,Delete,Get,NotFoundException,Post,Query,Req,UseGuards} from '@nestjs/common';
import {Transform} from 'class-transformer';
import {ArrayMaxSize,ArrayMinSize,ArrayUnique,IsArray,IsIn,IsOptional,IsString,IsUUID,Length,MaxLength} from 'class-validator';
import {PrismaService} from '../prisma/prisma.service';
import {JwtAuthGuard,type AuthenticatedRequest} from '../auth/jwt-auth.guard';
class SelectionDto {
 @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ArrayUnique() @IsString({each:true}) @Length(1,100,{each:true}) ids!:string[];
}
class SearchDto {
 @Transform(({value})=>typeof value==='string'?value.normalize('NFKC').trim().replace(/\s+/g,' '):value)
 @IsString() @Length(2,160) query!:string;
 @IsIn(['mine','official','ready','community','saved','following','moderation','profile']) source!:string;
 @IsOptional() @IsUUID() profileUserId?:string;
 @IsArray() @ArrayMaxSize(3) @ArrayUnique() @IsString({each:true}) @MaxLength(100,{each:true}) recipeIds!:string[];
}
const author={select:{id:true,name:true,deletedAt:true,profile:{select:{avatarUrl:true}}}} as const;
const summary={id:true,title:true,description:true,imageUrl:true,emoji:true,preparationMinutes:true,servings:true,difficulty:true,calories:true,protein:true,fat:true,carbs:true,mealType:true,publishedAt:true,createdAt:true,isPublished:true,isShared:true,authorId:true,author} as const;
@Controller('library')
@UseGuards(JwtAuthGuard)
export class AccountController {
 constructor(private readonly prisma:PrismaService){}
 private visible(userId:string){return {OR:[{authorId:userId},{...publicRecipeFilter,OR:[{isPublished:true},{isShared:true}]}]};}
 @Get('saved-items')
 async savedItems(@Req() req:AuthenticatedRequest){
  const items=await this.prisma.favorite.findMany({where:{userId:req.user.id},orderBy:{createdAt:'desc'},select:{recipeId:true,createdAt:true}});
  const recipes=await this.prisma.recipe.findMany({where:{id:{in:items.map(x=>x.recipeId)},...this.visible(req.user.id)},select:summary});
  const byId=new Map(recipes.map(r=>[r.id,r]));return items.map(x=>({id:x.recipeId,savedAt:x.createdAt,recipe:byId.get(x.recipeId)??null}));
 }
 @Delete('saved')
 async removeSaved(@Req() req:AuthenticatedRequest,@Body() dto:SelectionDto){return this.prisma.favorite.deleteMany({where:{userId:req.user.id,recipeId:{in:dto.ids}}});}
 @Delete('following')
 async removeFollowing(@Req() req:AuthenticatedRequest,@Body() dto:SelectionDto){return this.prisma.follow.deleteMany({where:{followerId:req.user.id,followingId:{in:dto.ids}}});}
 @Post('history')
 async record(@Req() req:AuthenticatedRequest,@Body() dto:SearchDto){
  if(dto.source==='profile'&&!dto.profileUserId)throw new BadRequestException('Вкажіть профіль пошуку');
  if(dto.profileUserId&&!await this.prisma.user.findUnique({where:{id:dto.profileUserId},select:{id:true}}))throw new NotFoundException('Користувача не знайдено');
  const visible=await this.prisma.recipe.findMany({where:{id:{in:dto.recipeIds},...this.visible(req.user.id)},select:{id:true}});
  const ids=dto.recipeIds.filter(id=>visible.some(r=>r.id===id));
  return this.prisma.$transaction(async tx=>{
   const recent=await tx.searchHistory.findFirst({where:{userId:req.user.id,query:dto.query,source:dto.source,profileUserId:dto.profileUserId??null,createdAt:{gte:new Date(Date.now()-5*60*1000)}},orderBy:{createdAt:'desc'}});
   const data={query:dto.query,source:dto.source,profileUserId:dto.profileUserId??null,recipeIds:ids,createdAt:new Date()};
   return recent?tx.searchHistory.update({where:{id:recent.id},data}):tx.searchHistory.create({data:{...data,userId:req.user.id}});
  });
 }
 @Get('history')
 async history(@Req() req:AuthenticatedRequest,@Query('cursor') cursor?:string){
  const previous=cursor?await this.prisma.searchHistory.findFirst({where:{id:cursor,userId:req.user.id}}):null;
  if(cursor&&!previous)throw new NotFoundException('Запис історії не знайдено');
  const rows=await this.prisma.searchHistory.findMany({where:{userId:req.user.id,...(previous?{OR:[{createdAt:{lt:previous.createdAt}},{createdAt:previous.createdAt,id:{lt:previous.id}}]}:{})},orderBy:[{createdAt:'desc'},{id:'desc'}],take:101});
  const page=rows.slice(0,100);const ids=[...new Set(page.flatMap(x=>Array.isArray(x.recipeIds)?x.recipeIds.filter((v):v is string=>typeof v==='string'):[]))];
  const recipes=await this.prisma.recipe.findMany({where:{id:{in:ids},...this.visible(req.user.id)},select:summary});
  const people=await this.prisma.user.findMany({where:{id:{in:page.map(x=>x.profileUserId).filter((x):x is string=>!!x)}},select:{id:true,name:true,deletedAt:true,profile:{select:{avatarUrl:true}}}});
  const byId=new Map(recipes.map(r=>[r.id,r]));
  return {items:page.map(({recipeIds,...row})=>({...row,profileUser:people.find(p=>p.id===row.profileUserId)??null,recipes:(Array.isArray(recipeIds)?recipeIds:[]).flatMap(id=>typeof id==='string'&&byId.has(id)?[byId.get(id)!]:[])})),nextCursor:rows.length>100?page[page.length-1].id:null};
 }
 @Delete('history')
 async removeHistory(@Req() req:AuthenticatedRequest,@Body() dto:SelectionDto){return this.prisma.searchHistory.deleteMany({where:{userId:req.user.id,id:{in:dto.ids}}});}
 @Get('stats')
 async stats(@Req() req:AuthenticatedRequest){
  const id=req.user.id;
  const role=await this.prisma.user.findUnique({where:{id},select:{role:true}});
  const readable=role?.role==='MODERATOR'?{}:this.visible(id);
  const [recipes,official,shared,saved,following,followers,history,ratings,byMeal,myComments,communityComments,repostsMade,repostsReceived]=await Promise.all([
   this.prisma.recipe.count({where:{authorId:id}}),this.prisma.recipe.count({where:{authorId:id,isPublished:true}}),this.prisma.recipe.count({where:{authorId:id,isShared:true,isPublished:false}}),
   this.prisma.favorite.count({where:{userId:id}}),this.prisma.follow.count({where:{followerId:id}}),this.prisma.follow.count({where:{followingId:id}}),this.prisma.searchHistory.count({where:{userId:id}}),
   this.prisma.rating.aggregate({where:{recipe:{authorId:id}},_avg:{value:true},_count:true}),this.prisma.recipe.groupBy({by:['mealType'],where:{authorId:id},_count:true}),this.prisma.comment.count({where:{userId:id,deletedAt:null,hiddenAt:null,recipe:readable}}),this.prisma.comment.count({where:{userId:{not:id},deletedAt:null,hiddenAt:null,recipe:{authorId:id}}}),this.prisma.recipeRepost.count({where:{userId:id}}),this.prisma.recipeRepost.count({where:{recipe:{authorId:id}}})
  ]);
  return {repostsMade,repostsReceived,recipes,official,shared,saved,following,followers,history,myComments,communityComments,averageRating:ratings._avg.value,ratingCount:ratings._count,byMeal:byMeal.map(x=>({meal:x.mealType,count:x._count}))};
 }
}
