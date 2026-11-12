import {BadRequestException,Body,Controller,Delete,ForbiddenException,Get,NotFoundException,Param,Post,Put,Query,Req,UseGuards} from '@nestjs/common';
import {IsBoolean,IsString,Length} from 'class-validator';
import {JwtAuthGuard,type AuthenticatedRequest} from '../auth/jwt-auth.guard';
import {PrismaService} from '../prisma/prisma.service';
import {ManagementService,publicPerson,rights,rightNames} from './management.service';
class GrantDto {
 @IsString() @Length(3,100) target!:string;
 @IsBoolean() editRecipes!:boolean;
 @IsBoolean() hideRecipes!:boolean;
 @IsBoolean() manageComments!:boolean;
 @IsBoolean() editProfile!:boolean;
 @IsString() @Length(0,4000) instructions!:string;
}
class FlagDto {@IsBoolean() value!:boolean;}
@Controller('management')
@UseGuards(JwtAuthGuard)
export class ManagementController {
 constructor(private readonly prisma:PrismaService,private readonly access:ManagementService){}
 @Get('grants') grants(@Req() req:AuthenticatedRequest){return this.prisma.blogGrant.findMany({where:{ownerId:req.user.id},include:{admin:{select:publicPerson}},orderBy:{createdAt:'asc'}});}
 @Put('grants')
 async grant(@Req() req:AuthenticatedRequest,@Body() dto:GrantDto){
  const query=dto.target.normalize('NFKC').trim();const person=await this.prisma.user.findFirst({where:{deletedAt:null,OR:[{id:query},{handle:query.replace(/^@/,'').toLocaleLowerCase('uk')}]},select:publicPerson});
  if(!person)throw new NotFoundException('Користувача не знайдено за ID або ніком');
  if(person.id===req.user.id)throw new BadRequestException('Ви вже є власником цього профілю');
  if(!rights.some(k=>dto[k]))throw new BadRequestException('Оберіть хоча б одне право або відкличте доступ');
  const {target,...data}=dto;
  return this.prisma.$transaction(async tx=>{
   const existing=await tx.blogGrant.findUnique({where:{ownerId_adminId:{ownerId:req.user.id,adminId:person.id}}});
   if(!existing&&await tx.blogGrant.count({where:{ownerId:req.user.id}})>=5)throw new BadRequestException('Можна призначити не більше 5 адміністраторів');
   const grant=await tx.blogGrant.upsert({where:{ownerId_adminId:{ownerId:req.user.id,adminId:person.id}},create:{...data,ownerId:req.user.id,adminId:person.id},update:data,include:{admin:{select:publicPerson}}});
   const owner=await tx.user.findUniqueOrThrow({where:{id:req.user.id},select:publicPerson});
   await this.access.notice(person.id,existing?'Ваші права адміністратора змінено':'Вам надано права адміністратора',`Автор: ${owner.name} (@${owner.handle}).\nПоточні права:\n${rights.filter(k=>dto[k]).map(k=>'• '+rightNames[k]).join('\n')}\n\nПравила та інструкція автора:\n${dto.instructions||'Додаткових інструкцій немає.'}\n\nДоступ діє лише у профілі цього автора. Передавати права іншим заборонено. Відмовитися можна в особистому кабінеті → Мої повноваження.`,req.user.id,tx);
   await this.access.log(req.user.id,req.user.id,existing?'grant.update':'grant.create',person.id,person.name,{before:existing,after:data},tx);return grant;
  });
 }
 @Delete('grants/:adminId')
 async revoke(@Req() req:AuthenticatedRequest,@Param('adminId') adminId:string){return this.prisma.$transaction(async tx=>{
  const old=await tx.blogGrant.findUnique({where:{ownerId_adminId:{ownerId:req.user.id,adminId}}});if(!old)throw new NotFoundException('Доступ не знайдено');
  await tx.blogGrant.delete({where:{id:old.id}});await this.access.notice(adminId,'Доступ адміністратора відкликано','Автор відкликав усі ваші права в цьому профілі.',req.user.id,tx);await this.access.log(req.user.id,req.user.id,'grant.revoke',adminId,'Відкликано доступ',{before:old},tx);return {deleted:true};
 });}
 @Get('assignments') assignments(@Req() req:AuthenticatedRequest){return this.prisma.blogGrant.findMany({where:{adminId:req.user.id},include:{owner:{select:publicPerson}},orderBy:{createdAt:'desc'}});}
 @Delete('assignments/:ownerId')
 async resign(@Req() req:AuthenticatedRequest,@Param('ownerId') ownerId:string){return this.prisma.$transaction(async tx=>{
  const old=await tx.blogGrant.findUnique({where:{ownerId_adminId:{ownerId,adminId:req.user.id}}});if(!old)throw new NotFoundException('Доступ не знайдено');await tx.blogGrant.delete({where:{id:old.id}});await this.access.notice(ownerId,'Адміністратор відмовився від повноважень','Доступ адміністратора припинено за його бажанням.',ownerId,tx);await this.access.log(req.user.id,ownerId,'grant.resign',req.user.id,'Відмова від повноважень',{before:old},tx);return {deleted:true};
 });}
 @Get('workspace/:ownerId')
 async workspace(@Req() req:AuthenticatedRequest,@Param('ownerId') ownerId:string){const permissions=await this.access.permissions(req.user.id,ownerId);if(!rights.some(k=>permissions[k]))throw new ForbiddenException('Немає доступу до цього кабінету');const owner=await this.prisma.user.findUnique({where:{id:ownerId},select:publicPerson});if(!owner)throw new NotFoundException('Автора не знайдено');const canRecipes=permissions.editRecipes||permissions.hideRecipes||permissions.manageComments;return {owner,permissions,recipes:canRecipes?await this.prisma.recipe.findMany({where:{authorId:ownerId},include:{ingredients:{include:{ingredient:true}}},orderBy:{updatedAt:'desc'}}):[]};}
 @Put('recipes/:id/hidden')
 async hideRecipe(@Req() req:AuthenticatedRequest,@Param('id') id:string,@Body() dto:FlagDto){const recipe=await this.access.recipe(req.user.id,id);await this.access.require(req.user.id,recipe.authorId,'hideRecipes');return this.prisma.$transaction(async tx=>{const result=await tx.recipe.update({where:{id},data:{hiddenAt:dto.value?new Date():null}});await this.access.log(req.user.id,recipe.authorId,dto.value?'recipe.hide':'recipe.restore',id,recipe.title,{before:recipe.hiddenAt,after:result.hiddenAt},tx);return result;});}
 @Put('comments/:id/:operation')
 async comment(@Req() req:AuthenticatedRequest,@Param('id') id:string,@Param('operation') operation:string,@Body() dto:FlagDto){
  if(!['hidden','pinned'].includes(operation))throw new BadRequestException('Невідома дія');const c=await this.prisma.comment.findUnique({where:{id},include:{recipe:true}});if(!c||c.deletedAt)throw new NotFoundException('Коментар не знайдено');await this.access.require(req.user.id,c.recipe.authorId,'manageComments');if(operation==='pinned'&&dto.value&&c.hiddenAt)throw new BadRequestException('Спочатку відновіть прихований коментар');
  return this.prisma.$transaction(async tx=>{const result=await tx.comment.update({where:{id},data:operation==='hidden'?{hiddenAt:dto.value?new Date():null,...(dto.value?{pinnedAt:null}:{})}:{pinnedAt:dto.value?new Date():null}});await this.access.log(req.user.id,c.recipe.authorId,operation==='hidden'?(dto.value?'comment.hide':'comment.restore'):(dto.value?'comment.pin':'comment.unpin'),id,c.recipe.title,{recipeId:c.recipeId,text:c.text,before:{hiddenAt:c.hiddenAt,pinnedAt:c.pinnedAt},after:{hiddenAt:result.hiddenAt,pinnedAt:result.pinnedAt}},tx);return result;});
 }
 @Get('notices') async notices(@Req() req:AuthenticatedRequest){const [items,unread]=await Promise.all([this.prisma.accountNotice.findMany({where:{recipientId:req.user.id},orderBy:{createdAt:'desc'},take:100}),this.prisma.accountNotice.count({where:{recipientId:req.user.id,readAt:null}})]);return {items,unread};}
 @Put('notices/read-all') async readAll(@Req() req:AuthenticatedRequest){return this.prisma.accountNotice.updateMany({where:{recipientId:req.user.id,readAt:null},data:{readAt:new Date()}});}
 @Put('notices/:id/read') async read(@Req() req:AuthenticatedRequest,@Param('id') id:string){const result=await this.prisma.accountNotice.updateMany({where:{id,recipientId:req.user.id},data:{readAt:new Date()}});if(!result.count)throw new NotFoundException('Повідомлення не знайдено');return result;}
}
