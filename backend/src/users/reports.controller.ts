import {BadRequestException,Body,ConflictException,Controller,ForbiddenException,Get,NotFoundException,Param,Post,Query,Req,UseGuards} from '@nestjs/common';
import {Transform} from 'class-transformer';
import {ArrayMaxSize,ArrayUnique,IsArray,IsIn,IsOptional,IsString,IsUUID,Length} from 'class-validator';
import {PrismaService} from '../prisma/prisma.service';
import {JwtAuthGuard,type AuthenticatedRequest} from '../auth/jwt-auth.guard';
import {ManagementService,publicPerson} from './management.service';
export const reportReasons={spam:'Спам або реклама',harassment:'Образи чи переслідування',hate:'Мова ворожнечі',danger:'Небезпечний вміст',misleading:'Оманлива інформація',impersonation:'Видає себе за іншу людину',privacy:'Порушення приватності',inappropriate:'Неприйнятний вміст',other:'Інша причина'};
class ReportDto {
 @IsIn(['USER','PROFILE','COMMENT','RECIPE']) type!:string;
 @IsUUID() targetId!:string;
 @IsArray() @ArrayMaxSize(9) @ArrayUnique() @IsIn(Object.keys(reportReasons),{each:true}) reasons!:string[];
 @Transform(({value})=>typeof value==='string'?value.trim():value) @IsString() @Length(0,2000) customReason!:string;
}
class DecisionDto {
 @IsIn(['DISMISS','HIDE_COMMENT','HIDE_RECIPE','HIDE_PROFILE']) action!:string;
 @Transform(({value})=>typeof value==='string'?value.trim():value) @IsString() @Length(5,2000) note!:string;
}
@Controller()
@UseGuards(JwtAuthGuard)
export class ReportsController {
 constructor(private readonly prisma:PrismaService,private readonly access:ManagementService){}
 @Post('reports')
 async report(@Req() req:AuthenticatedRequest,@Body() dto:ReportDto){
  if(!dto.reasons.length&&!dto.customReason)throw new BadRequestException('Оберіть причину або опишіть її');if(dto.reasons.includes('other')&&dto.customReason.length<5)throw new BadRequestException('Опишіть іншу причину щонайменше 5 символами');
  let targetUserId:string,recipeId:string|undefined,commentId:string|undefined,snapshot:unknown;
  if(dto.type==='COMMENT'){
   const comment=await this.prisma.comment.findUnique({where:{id:dto.targetId},include:{recipe:{select:{id:true,title:true,authorId:true}},user:{select:publicPerson}}});if(!comment||comment.deletedAt)throw new NotFoundException('Коментар не знайдено');await this.access.recipe(req.user.id,comment.recipeId);targetUserId=comment.userId;recipeId=comment.recipeId;commentId=comment.id;snapshot={text:comment.hiddenAt?'Коментар приховано':comment.text,recipe:comment.recipe,user:comment.user};
  }else if(dto.type==='RECIPE'){
   const recipe=await this.access.recipe(req.user.id,dto.targetId);if(!recipe.authorId)throw new BadRequestException('У рецепта немає автора');targetUserId=recipe.authorId;recipeId=recipe.id;snapshot={recipe:{id:recipe.id,title:recipe.title,imageUrl:recipe.imageUrl,emoji:recipe.emoji}};
  }else{
   const user=await this.prisma.user.findUnique({where:{id:dto.targetId},select:{...publicPerson,profileHiddenAt:true}});if(!user||user.profileHiddenAt&&!await this.access.moderator(req.user.id))throw new NotFoundException('Профіль недоступний');targetUserId=user.id;snapshot={user};
  }
  if(targetUserId===req.user.id)throw new BadRequestException('Не можна скаржитися на себе');
  return this.prisma.$transaction(async tx=>{
   if(await tx.report.findFirst({where:{reporterId:req.user.id,targetType:dto.type,targetId:dto.targetId,status:'OPEN'}}))throw new ConflictException('Ваша скарга на цей об’єкт уже очікує розгляду');
   if(await tx.report.count({where:{reporterId:req.user.id,createdAt:{gte:new Date(Date.now()-3600000)}}})>=10)throw new BadRequestException('Ліміт: 10 скарг на годину');
   const result=await tx.report.create({data:{reporterId:req.user.id,targetUserId,targetType:dto.type,targetId:dto.targetId,recipeId,commentId,snapshot:JSON.parse(JSON.stringify(snapshot)),reasons:dto.reasons,customReason:dto.customReason}});return {id:result.id,status:result.status};
  });
 }
 @Get('moderation/reports')
 async list(@Req() req:AuthenticatedRequest,@Query('status') status='OPEN',@Query('page') page='0'){
  await this.mod(req.user.id);if(!['OPEN','RESOLVED','DISMISSED','ALL'].includes(status))throw new BadRequestException('Некоректний статус');const where=status==='ALL'?{}:{status};const offset=Math.max(0,Number.parseInt(page)||0);
  const [items,total,open]=await Promise.all([this.prisma.report.findMany({where,orderBy:{createdAt:'desc'},skip:Math.min(10000,offset)*30,take:30}),this.prisma.report.count({where}),this.prisma.report.count({where:{status:'OPEN'}})]);
  const ids=[...new Set(items.flatMap(r=>[r.reporterId,r.targetUserId,...(r.resolvedById?[r.resolvedById]:[])]))];const people=await this.prisma.user.findMany({where:{id:{in:ids}},select:publicPerson});return {items:items.map(r=>({...r,reporter:people.find(p=>p.id===r.reporterId),targetUser:people.find(p=>p.id===r.targetUserId),resolver:people.find(p=>p.id===r.resolvedById)})),total,open,page:offset,reasons:reportReasons};
 }
 private async mod(id:string){if(!await this.access.moderator(id))throw new ForbiddenException('Потрібні права модератора');}
 @Post('moderation/reports/:id/decision')
 async decision(@Req() req:AuthenticatedRequest,@Param('id') id:string,@Body() dto:DecisionDto){await this.mod(req.user.id);return this.prisma.$transaction(async tx=>{
  const r=await tx.report.findUnique({where:{id}});if(!r)throw new NotFoundException('Скаргу не знайдено');if(r.status!=='OPEN')throw new ConflictException('Скаргу вже розглянуто');
  let action='report.dismiss';
  if(dto.action==='HIDE_COMMENT'){
   if(!r.commentId)throw new BadRequestException('Скарга не стосується коментаря');const c=await tx.comment.findUnique({where:{id:r.commentId},include:{recipe:{select:{authorId:true,title:true}}}});if(!c||c.deletedAt)throw new NotFoundException('Коментар уже видалено');await tx.comment.update({where:{id:c.id},data:{hiddenAt:new Date(),pinnedAt:null}});await this.access.log(req.user.id,c.recipe.authorId,'comment.hide',c.id,c.recipe.title,{recipeId:c.recipeId,text:c.text,reportId:id,reason:dto.note},tx);action='report.resolve';
  }else if(dto.action==='HIDE_RECIPE'){
   if(!r.recipeId)throw new BadRequestException('Скарга не стосується рецепта');const recipe=await tx.recipe.findUnique({where:{id:r.recipeId},select:{authorId:true,title:true}});if(!recipe)throw new NotFoundException('Рецепт уже видалено');await tx.recipe.update({where:{id:r.recipeId},data:{hiddenAt:new Date()}});await this.access.log(req.user.id,recipe.authorId,'recipe.hide',r.recipeId,recipe.title,{reportId:id,reason:dto.note},tx);action='report.resolve';
  }else if(dto.action==='HIDE_PROFILE'){
   await tx.user.update({where:{id:r.targetUserId},data:{profileHiddenAt:new Date()}});await this.access.log(req.user.id,r.targetUserId,'profile.hide',r.targetUserId,'Профіль приховано',{reportId:id,reason:dto.note},tx);action='report.resolve';
  }
  const result=await tx.report.update({where:{id},data:{status:dto.action==='DISMISS'?'DISMISSED':'RESOLVED',decision:dto.action,resolutionNote:dto.note,resolvedById:req.user.id,resolvedAt:new Date()}});
  await this.access.log(req.user.id,r.targetUserId,action,id,'Розгляд скарги',{decision:dto.action,reason:dto.note,reporterId:r.reporterId},tx);
  await this.access.notice(r.reporterId,'Вашу скаргу розглянуто',`${dto.action==='DISMISS'?'Скаргу відхилено.':'Модерація вжила заходів.'}\nПояснення: ${dto.note}`,r.targetUserId,tx);return result;
 });}
}
