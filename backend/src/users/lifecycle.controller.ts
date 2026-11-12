import {randomBytes} from 'node:crypto';
import {Transform} from 'class-transformer';
import {BadRequestException,Body,Controller,ConflictException,Delete,ForbiddenException,Get,NotFoundException,Param,Post,Req,UseGuards} from '@nestjs/common';
import {ArrayMaxSize,ArrayUnique,IsArray,IsIn,IsString,IsUUID,Length} from 'class-validator';
import * as argon2 from 'argon2';
import {PrismaService} from '../prisma/prisma.service';
import {JwtAuthGuard,type AuthenticatedRequest} from '../auth/jwt-auth.guard';
import {ManagementService} from './management.service';
class PlanDto {
 @IsIn(['ALL','UNPUBLISHED','KEEP','PUBLISH']) mode!:string;
 @IsArray() @ArrayMaxSize(2000) @ArrayUnique() @IsUUID(undefined,{each:true}) recipeIds!:string[];
 @IsIn(['ВИДАЛИТИ']) confirmation!:string;
}
class SelfDeleteDto extends PlanDto {@IsString() @Length(1,256) password!:string;}
class ModeratorDeleteDto extends PlanDto {@Transform(({value})=>typeof value==='string'?value.trim():value) @IsString() @Length(5,2000) reason!:string;}
class HandleDto {
 @IsIn(['SET','RESET']) action!:string;
 @Transform(({value})=>typeof value==='string'?value.trim():value) @IsString() @Length(0,100) handle!:string;
 @Transform(({value})=>typeof value==='string'?value.trim():value) @IsString() @Length(5,2000) reason!:string;
}
class ReasonDto {@Transform(({value})=>typeof value==='string'?value.trim():value) @IsString() @Length(5,2000) reason!:string;}
@Controller()
@UseGuards(JwtAuthGuard)
export class LifecycleController {
 constructor(private readonly prisma:PrismaService,private readonly access:ManagementService){}
 @Get('account/deletion-preview') preview(@Req() req:AuthenticatedRequest){return this.previewFor(req.user.id);}
 @Get('moderation/accounts/:id/deletion-preview') async modPreview(@Req() req:AuthenticatedRequest,@Param('id') id:string){await this.requireModerator(req.user.id);return this.previewFor(id);}
 private async requireModerator(id:string){if(!await this.access.moderator(id))throw new ForbiddenException('Потрібні права модератора');}
 private async previewFor(id:string){
  const user=await this.prisma.user.findUnique({where:{id},select:{id:true,name:true,handle:true,email:true,deletedAt:true,deletionReason:true,profileHiddenAt:true,profile:{select:{avatarUrl:true}}}});if(!user)throw new NotFoundException('Користувача не знайдено');
  const recipes=await this.prisma.recipe.findMany({where:{authorId:id},select:{id:true,title:true,emoji:true,imageUrl:true,isShared:true,isPublished:true,hiddenAt:true,mealType:true},orderBy:{title:'asc'}});
  return {user,recipes,total:recipes.length,unpublished:recipes.filter(r=>!r.isShared&&!r.isPublished&&!r.hiddenAt).length,hidden:recipes.filter(r=>r.hiddenAt).length};
 }
 @Delete('account')
 async removeSelf(@Req() req:AuthenticatedRequest,@Body() dto:SelfDeleteDto){const user=await this.prisma.user.findUniqueOrThrow({where:{id:req.user.id},select:{passwordHash:true}});if(!await argon2.verify(user.passwordHash,dto.password))throw new BadRequestException('Неправильний поточний пароль');return this.deactivate(req.user.id,req.user.id,dto,'Користувач самостійно видалив акаунт');}
 @Post('moderation/accounts/:id/delete')
 async removeByModerator(@Req() req:AuthenticatedRequest,@Param('id') id:string,@Body() dto:ModeratorDeleteDto){await this.requireModerator(req.user.id);if(id===req.user.id)throw new BadRequestException('Для власного акаунта скористайтеся видаленням у профілі');return this.deactivate(req.user.id,id,dto,dto.reason);}
 private async deactivate(actorId:string,id:string,dto:PlanDto,reason:string){
  return this.prisma.$transaction(async tx=>{
   const user=await tx.user.findUnique({where:{id},include:{profile:true}});if(!user)throw new NotFoundException('Користувача не знайдено');if(user.deletedAt)throw new BadRequestException('Акаунт уже видалено');
   if(user.role==='MODERATOR'&&await tx.user.count({where:{role:'MODERATOR',deletedAt:null}})<=1)throw new BadRequestException('Спочатку забезпечте доступ іншого активного модератора для відновлення акаунтів');
   if(dto.mode!=='PUBLISH'&&dto.recipeIds.length)throw new BadRequestException('Вибір рецептів доступний лише для публікації');
   const candidates=await tx.recipe.findMany({where:{authorId:id,OR:[{hiddenAt:{not:null}},{isShared:false,isPublished:false}]},select:{id:true}});
   if(dto.mode==='PUBLISH'&&(!dto.recipeIds.length||dto.recipeIds.some(r=>!candidates.some(c=>c.id===r))))throw new BadRequestException('Оберіть власні неопубліковані або приховані рецепти');
   await tx.previousHandle.create({data:{userId:id,handle:user.handle,name:user.name}});
   let replacementHandle='departed_'+randomBytes(10).toString('hex');while(await tx.user.findUnique({where:{handle:replacementHandle},select:{id:true}}))replacementHandle='departed_'+randomBytes(10).toString('hex');
   const now=new Date();let deleted=0,published=0;
   if(dto.mode==='ALL'||dto.mode==='UNPUBLISHED')deleted=(await tx.recipe.deleteMany({where:{authorId:id,...(dto.mode==='UNPUBLISHED'?{OR:[{hiddenAt:{not:null}},{isShared:false,isPublished:false}]}:{})}})).count;
   if(dto.mode==='PUBLISH'){
    const selected=await tx.recipe.findMany({where:{id:{in:dto.recipeIds},authorId:id},select:{id:true,publishedAt:true,isPublished:true}});
    for(const r of selected)await tx.recipe.update({where:{id:r.id},data:{isShared:r.isPublished?undefined:true,hiddenAt:null,publishedAt:r.publishedAt??now}});published=selected.length;
   }
   const grants=await tx.blogGrant.findMany({where:{ownerId:id},select:{adminId:true}});for(const g of grants)await this.access.notice(g.adminId,'Доступ адміністратора припинено',`${user.name} покинув сервіс. Повноваження в його профілі припинено.`,id,tx);
   await tx.blogGrant.deleteMany({where:{OR:[{ownerId:id},{adminId:id}]}});
   await tx.fridgeItem.deleteMany({where:{userId:id}});await tx.favorite.deleteMany({where:{userId:id}});await tx.recipeCollection.deleteMany({where:{userId:id}});await tx.recipeNote.deleteMany({where:{userId:id}});await tx.shoppingListItem.deleteMany({where:{userId:id}});await tx.searchHistory.deleteMany({where:{userId:id}});await tx.chatTurn.deleteMany({where:{userId:id}});await tx.follow.deleteMany({where:{OR:[{followerId:id},{followingId:id}]}});
   await tx.user.update({where:{id},data:{handle:replacementHandle,deletedAt:now,deletionReason:reason,authVersion:{increment:1},profile:{upsert:{create:{bio:'',showRecipes:true},update:{bio:'',coverUrl:null,showRecipes:true}}}}});
   await this.access.log(actorId,id,'account.delete',id,user.name,{reason,mode:dto.mode,deletedRecipes:deleted,publishedRecipes:published,publishedIds:dto.recipeIds,retainedIdentity:{id:user.id,name:user.name,handle:user.handle},profileBefore:user.profile},tx);
   return {deleted:true,deletedRecipes:deleted,publishedRecipes:published};
  });
 }
 @Post('moderation/accounts/:id/handle')
 async handle(@Req() req:AuthenticatedRequest,@Param('id') id:string,@Body() dto:HandleDto){
  await this.requireModerator(req.user.id);
  let handle=dto.handle.normalize('NFKC').replace(/^@/,'').toLocaleLowerCase('uk');
  if(dto.action==='SET'&&!/^[\p{L}\p{N}_][\p{L}\p{N}_.-]{1,30}[\p{L}\p{N}_]$/u.test(handle))throw new BadRequestException('Тег: 3–32 літери, цифри, _, крапки або дефіси; без крапки чи дефіса на кінці');
  try{return await this.prisma.$transaction(async tx=>{
   const user=await tx.user.findUnique({where:{id},select:{name:true,handle:true,deletedAt:true}});if(!user)throw new NotFoundException('Користувача не знайдено');
   if(dto.action==='RESET'){do{handle=(user.deletedAt?'departed_':'user_')+randomBytes(10).toString('hex');}while(await tx.user.findUnique({where:{handle},select:{id:true}}));}
   const occupied=await tx.user.findUnique({where:{handle},select:{id:true}});if(occupied&&occupied.id!==id)throw new ConflictException('Цей тег уже зайнятий');
   await tx.user.update({where:{id},data:{handle}});
   await this.access.log(req.user.id,id,dto.action==='RESET'?'profile.handle-reset':'profile.handle-set',id,user.name,{before:{handle:user.handle},after:{handle},reason:dto.reason},tx);
   await this.access.notice(id,'Ваш тег змінено модерацією',`Новий тег: @${handle}\nПричина: ${dto.reason}`,id,tx);
   return {handle};
  });}catch(e){if((e as {code?:string}).code==='P2002')throw new ConflictException('Цей тег уже зайнятий');throw e;}
 }
 @Post('moderation/accounts/:id/restore')
 async restore(@Req() req:AuthenticatedRequest,@Param('id') id:string,@Body() dto:ReasonDto){await this.requireModerator(req.user.id);return this.prisma.$transaction(async tx=>{const user=await tx.user.findUnique({where:{id},select:{id:true,name:true,deletedAt:true}});if(!user||!user.deletedAt)throw new BadRequestException('Немає видаленого акаунта для відновлення');await tx.user.update({where:{id},data:{deletedAt:null,deletionReason:null,authVersion:{increment:1}}});await this.access.log(req.user.id,id,'account.restore',id,user.name,{reason:dto.reason},tx);return {restored:true};});}
 @Post('moderation/profiles/:id/:operation')
 async profileVisibility(@Req() req:AuthenticatedRequest,@Param('id') id:string,@Param('operation') operation:string,@Body() dto:ReasonDto){await this.requireModerator(req.user.id);if(!['hide','restore'].includes(operation))throw new BadRequestException('Невідома дія');return this.prisma.$transaction(async tx=>{const user=await tx.user.findUnique({where:{id},select:{name:true}});if(!user)throw new NotFoundException('Користувача не знайдено');await tx.user.update({where:{id},data:{profileHiddenAt:operation==='hide'?new Date():null}});await this.access.log(req.user.id,id,'profile.'+operation,id,user.name,{reason:dto.reason},tx);return {hidden:operation==='hide'};});}
}
