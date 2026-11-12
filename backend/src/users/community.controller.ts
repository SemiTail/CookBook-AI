import {ManagementService,publicRecipeFilter} from './management.service';
import {commentInclude,mentionedHandles,personSelect} from "./social.shared";
import { BadRequestException, ConflictException, Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { Transform } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, IsUrl, IsUUID, Matches, ValidateIf, Length, Max, Min } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard, PublicRead, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
class CommentDto { @IsOptional() @IsUUID() parentId?:string; @Transform(({value}) => typeof value === "string" ? value.trim() : value) @IsString() @Length(1,4000) text!: string; }
class RatingDto { @IsInt() @Min(1) @Max(5) value!: number; }
class ProfileDto {
 @ValidateIf((_,value)=>value!==undefined) @Transform(({value})=>typeof value==='string'?value.normalize('NFKC').trim().replace(/^@/,'').toLocaleLowerCase('uk'):value) @IsString() @Length(3,32) @Matches(/^[\p{L}\p{N}_](?:[\p{L}\p{N}_.-]{1,30}[\p{L}\p{N}_])$/u,{message:'Нік: 3–32 літери, цифри, _, крапки або дефіси; без крапки чи дефіса на кінці'}) handle?:string;

 @Transform(({value}) => typeof value === "string" ? value.trim() : value) @IsString() @Length(2,80) name!: string;
 @IsString() @Length(0,4000) bio!: string;
 @IsOptional() @IsUrl({ protocols: ["http","https"], require_protocol: true }) avatarUrl?: string | null;
 @IsOptional() @IsUrl({ protocols: ["http","https"], require_protocol: true }) coverUrl?: string | null;
 @IsBoolean() showRecipes!: boolean;
}
@Controller()
@UseGuards(JwtAuthGuard)
export class CommunityController {
 constructor(private readonly prisma: PrismaService,private readonly access:ManagementService) {}
 private async visible(id: string, userId: string) {
   await this.access.recipe(userId,id);
 }
 @Get("recipes/:id/favorite")
 async favorite(@Param("id") id:string,@Req() req:AuthenticatedRequest) { await this.visible(id,req.user.id); return { saved: !!(await this.prisma.favorite.findUnique({where:{userId_recipeId:{userId:req.user.id,recipeId:id}}})) }; }
 @Put("recipes/:id/favorite")
 async saveFavorite(@Param("id") id:string,@Req() req:AuthenticatedRequest) { await this.visible(id,req.user.id); await this.prisma.favorite.upsert({where:{userId_recipeId:{userId:req.user.id,recipeId:id}},create:{userId:req.user.id,recipeId:id},update:{}});return {saved:true}; }
 @Delete("recipes/:id/favorite")
 async unsaveFavorite(@Param("id") id:string,@Req() req:AuthenticatedRequest) { await this.visible(id,req.user.id);await this.prisma.favorite.deleteMany({where:{userId:req.user.id,recipeId:id}});return {saved:false}; }
 @Get("recipes/:id/discussion")
 @PublicRead()
 async discussion(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
   await this.visible(id, req.user.id);
   const [comments, ratings, mine] = await Promise.all([
     this.prisma.comment.findMany({ where: { recipeId: id }, orderBy: { createdAt: "asc" }, include: commentInclude }),
     this.prisma.rating.aggregate({ where: { recipeId: id }, _avg: { value: true }, _count: true }),
     this.prisma.rating.findUnique({ where: { userId_recipeId: { userId: req.user.id, recipeId: id } } })
   ]);
   const recipe=await this.prisma.recipe.findUniqueOrThrow({where:{id},select:{authorId:true,author:{select:{deletedAt:true}}}});
   const permissions=await this.access.permissions(req.user.id,recipe.authorId);
   const grants=recipe.authorId?await this.prisma.blogGrant.findMany({where:{ownerId:recipe.authorId},select:{adminId:true}}):[];
   const moderators=await this.prisma.user.findMany({where:{id:{in:comments.map(c=>c.userId)},role:'MODERATOR'},select:{id:true}});
   return {comments:comments.map(c=>({...c,text:c.hiddenAt&&!permissions.manageComments?'':c.text,parent:c.parent?{...c.parent,text:c.parent.hiddenAt&&!permissions.manageComments?'':c.parent.text}:null,role:c.userId===recipe.authorId?'author':moderators.some(m=>m.id===c.userId)?'moderator':grants.some(g=>g.adminId===c.userId)?'admin':null})),permissions,authorId:recipe.authorId,authorDeleted:!!recipe.author?.deletedAt,average: ratings._avg.value, count: ratings._count, mine: mine?.value ?? null };
 }
 @Post("recipes/:id/comments")
 async comment(@Param("id") id: string, @Req() req: AuthenticatedRequest, @Body() dto: CommentDto) {
   await this.visible(id, req.user.id);
   const recipe=await this.prisma.recipe.findUniqueOrThrow({where:{id},select:{authorId:true,isPublished:true,isShared:true}});
   const handles=mentionedHandles(dto.text);if(handles.length>10)throw new BadRequestException('В одному коментарі можна згадати до 10 людей');
   return this.prisma.$transaction(async tx=>{
    const parent=dto.parentId?await tx.comment.findFirst({where:{id:dto.parentId,recipeId:id,deletedAt:null,hiddenAt:null},include:{user:{select:personSelect}}}):null;
    if(dto.parentId&&!parent)throw new NotFoundException('Коментар для відповіді не знайдено в цьому рецепті');
    const people=await tx.user.findMany({where:{deletedAt:null,handle:{in:handles},...(!recipe.isPublished&&!recipe.isShared?{OR:[{id:recipe.authorId??''},{role:'MODERATOR' as const}]}:{})},select:personSelect});
    const targets=new Map(people.map(p=>[p.id,{recipientId:p.id,handle:p.handle,kind:'mention'}]));
    if(parent&&parent.userId!==req.user.id&&!targets.has(parent.userId)){
     const canRead=recipe.isPublished||recipe.isShared||recipe.authorId===parent.userId||(await tx.user.findUnique({where:{id:parent.userId},select:{role:true}}))?.role==='MODERATOR';
     if(canRead)targets.set(parent.userId,{recipientId:parent.userId,handle:parent.user.handle,kind:'reply'});
    }
    const result=await tx.comment.create({data:{text:dto.text,recipeId:id,userId:req.user.id,parentId:parent?.id??null}});
    const r=await tx.recipe.findUniqueOrThrow({where:{id},select:{title:true}});await this.access.log(req.user.id,recipe.authorId,'comment.create',result.id,r.title,{recipeId:id,text:dto.text,parentId:result.parentId},tx);
    for(const target of targets.values())if(target.recipientId!==req.user.id)await tx.commentMention.create({data:{...target,commentId:result.id}});
    return tx.comment.findUniqueOrThrow({where:{id:result.id},include:commentInclude});
   });
 }
 @Delete("recipes/:id/comments/:commentId")
 async remove(@Param("id") id: string, @Param("commentId") commentId: string, @Req() req: AuthenticatedRequest) {
   await this.visible(id, req.user.id);
   return this.prisma.$transaction(async tx=>{
    const old=await tx.comment.findFirst({where:{id:commentId,recipeId:id,userId:req.user.id,deletedAt:null},include:{recipe:{select:{title:true,authorId:true}}}});
    const result=await tx.comment.updateMany({where:{id:commentId,recipeId:id,userId:req.user.id,deletedAt:null},data:{text:'',deletedAt:new Date()}});
    if(!result.count)throw new NotFoundException('Коментар не знайдено');
    await tx.commentMention.deleteMany({where:{commentId}});if(old)await this.access.log(req.user.id,old.recipe.authorId,'comment.delete',commentId,old.recipe.title,{recipeId:id,text:old.text},tx);return {deleted:true};
   });
 }
 @Put("recipes/:id/rating")
 async rate(@Param("id") id: string, @Req() req: AuthenticatedRequest, @Body() dto: RatingDto) {
   await this.visible(id, req.user.id);
   return this.prisma.rating.upsert({ where: { userId_recipeId: { userId: req.user.id, recipeId: id } }, create: { userId: req.user.id, recipeId: id, value: dto.value }, update: { value: dto.value } });
 }
 @Put("users/me/profile")
 async update(@Req() req: AuthenticatedRequest, @Body() dto: ProfileDto) {
   return this.saveProfile(req.user.id,req.user.id,dto);
 }
 @Put("management/profile/:ownerId")
 async delegatedProfile(@Req() req:AuthenticatedRequest,@Param('ownerId') ownerId:string,@Body() dto:ProfileDto){await this.access.require(req.user.id,ownerId,'editProfile');if(dto.handle!==undefined)throw new BadRequestException('Адміністратор не може змінювати нік власника');return this.saveProfile(req.user.id,ownerId,dto);}
 @Get("management/profile/:ownerId")
 async managedProfile(@Req() req:AuthenticatedRequest,@Param('ownerId') ownerId:string){await this.access.require(req.user.id,ownerId,'editProfile');return this.prisma.user.findUniqueOrThrow({where:{id:ownerId},select:{id:true,name:true,handle:true,deletedAt:true,profileHiddenAt:true,profile:true}});}
 private async saveProfile(actorId:string,ownerId:string,dto:ProfileDto){
   const { name, handle, ...profile } = dto;
   try{return await this.prisma.$transaction(async tx=>{const before=await tx.user.findUnique({where:{id:ownerId},select:{id:true,name:true,handle:true,deletedAt:true,profileHiddenAt:true,profile:true}});const result=await tx.user.update({ where: { id: ownerId }, data: { name, ...(handle!==undefined?{handle}:{}), profile: { upsert: { create: profile, update: profile } } }, select: { id: true, name: true, handle:true, deletedAt:true,profileHiddenAt:true,profile: true } });await this.access.log(actorId,ownerId,'profile.edit',ownerId,result.name,{before,after:result},tx);return result;});}catch(e){if((e as {code?:string}).code==='P2002')throw new ConflictException('Цей нік уже зайнятий');throw e;}
 }
 @Get("users/:id/profile")
 @PublicRead()
 async profile(@Param("id") id: string,@Req() req:AuthenticatedRequest) {
   const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, name: true, handle:true, deletedAt:true,profileHiddenAt:true,profile: true } });
   if (!user) throw new NotFoundException("Користувача не знайдено");
   if(user.profileHiddenAt&&req.user.id!==id&&!await this.access.moderator(req.user.id))throw new NotFoundException('Профіль приховано модерацією');
   const recipes = user.profile?.showRecipes ? await this.prisma.recipe.findMany({ where: { authorId: id, ...publicRecipeFilter, OR: [{ isShared: true }, { isPublished: true }] }, include: { ingredients: { include: { ingredient: true } }, ratings: {select:{value:true}} }, orderBy: { updatedAt: "desc" } }) : [];
   const [repostsMade,repostsReceived]=await Promise.all([this.prisma.recipeRepost.count({where:{userId:id}}),this.prisma.recipeRepost.count({where:{recipe:{authorId:id,...publicRecipeFilter,OR:[{isShared:true},{isPublished:true}]}}})]);
   return { ...user,repostsMade,repostsReceived, recipes:recipes.map(({ratings,...recipe})=>({...recipe,averageRating:ratings.length?ratings.reduce((sum,r)=>sum+r.value,0)/ratings.length:null,ratingCount:ratings.length})) };
 }
}
