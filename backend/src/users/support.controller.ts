import {ProfileCardService} from './profile-card.service';
import {BadRequestException,Body,Controller,ForbiddenException,Get,Headers,NotFoundException,Param,Post,Query,Req,UseGuards} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {Transform} from 'class-transformer';
import {IsIn,IsString,IsOptional,IsUUID,Length,isEmail} from 'class-validator';
import {createHash,createHmac,randomBytes} from 'node:crypto';
import type {Request} from 'express';
import {PrismaService} from '../prisma/prisma.service';
import {JwtAuthGuard,type AuthenticatedRequest} from '../auth/jwt-auth.guard';
import {ManagementService} from './management.service';
const trim=({value}:{value:unknown})=>typeof value==='string'?value.trim():value;
class MessageDto {@Transform(trim) @IsString() @Length(0,4000) text!:string; @IsOptional() @IsUUID() profileUserId?:string;}
class GuestDto extends MessageDto {
 @Transform(trim) @IsString() @Length(2,80) name!:string;
 @IsIn(['EMAIL','PHONE']) contactType!:string;
 @Transform(trim) @IsString() @Length(5,254) contact!:string;
}
class StatusDto {@IsIn(['OPEN','CLOSED']) status!:string;}
@Controller()
export class SupportController {
 constructor(private readonly prisma:PrismaService,private readonly access:ManagementService,private readonly config:ConfigService,private readonly cards:ProfileCardService){}
 private async message(dto:MessageDto){if(!dto.text.trim()&&!dto.profileUserId)throw new BadRequestException('Введіть повідомлення або додайте картку профілю');if(dto.profileUserId&&!await this.cards.card(dto.profileUserId))throw new BadRequestException('Профіль недоступний для надсилання');}
 private hash(token:string){return createHash('sha256').update(token).digest('hex');}
 private async thread(id:string,token:string|undefined){if(!token||!/^[0-9a-f]{64}$/.test(token))throw new NotFoundException('Чат не знайдено');const thread=await this.prisma.supportThread.findFirst({where:{id,tokenHash:this.hash(token)}});if(!thread)throw new NotFoundException('Чат не знайдено');return thread;}
 private async mod(id:string){if(!await this.access.moderator(id))throw new ForbiddenException('Потрібні права модератора');}
 @Post('support/guest')
 async create(@Req() req:Request,@Body() dto:GuestDto){
  await this.message(dto);
  let contact=dto.contact;
  if(dto.contactType==='EMAIL'){if(!isEmail(contact))throw new BadRequestException('Вкажіть коректну електронну пошту');contact=contact.toLowerCase();}else{if(!/^\+?[\d ()-]+$/.test(contact))throw new BadRequestException('Вкажіть коректний телефон із кодом країни');contact=contact.replace(/[ ()-]/g,'');if(!/^\+?\d{8,15}$/.test(contact))throw new BadRequestException('Телефон має містити 8–15 цифр');}
  const ipHash=createHmac('sha256',this.config.getOrThrow<string>('JWT_SECRET')).update(req.ip||'local').digest('hex');const token=randomBytes(32).toString('hex');
  return this.prisma.$transaction(async tx=>{if(await tx.supportThread.count({where:{ipHash,createdAt:{gte:new Date(Date.now()-3600000)}}})>=3)throw new BadRequestException('Можна створити до 3 звернень на годину. Продовжіть наявний чат.');const thread=await tx.supportThread.create({data:{tokenHash:this.hash(token),contact,contactType:dto.contactType,guestName:dto.name,ipHash,messages:{create:{text:dto.text,authorName:dto.name,profileUserId:dto.profileUserId}}},select:{id:true}});return {id:thread.id,token};});
 }
 @Get('support/guest/:id/profiles')
 async searchGuest(@Param('id') id:string,@Headers('x-support-token') token:string,@Query('target') target:string){await this.thread(id,token);return this.cards.search(target);}
 @Get('moderation/support/profiles/search') @UseGuards(JwtAuthGuard)
 async searchModerator(@Req() req:AuthenticatedRequest,@Query('target') target:string){await this.mod(req.user.id);return this.cards.search(target);}
 @Get('support/guest/:id')
 async messages(@Param('id') id:string,@Headers('x-support-token') token:string){const thread=await this.thread(id,token);const [messages,total]=await this.prisma.$transaction(async tx=>{await tx.supportThread.update({where:{id},data:{lastSeenAt:new Date(),updatedAt:thread.updatedAt}});await tx.supportMessage.updateMany({where:{threadId:id,isModerator:true,deliveryStatus:{in:['QUEUED','IN_CHAT']}},data:{deliveryStatus:'READ'}});return Promise.all([tx.supportMessage.findMany({where:{threadId:id},orderBy:[{createdAt:'desc'},{id:'desc'}],take:200}),tx.supportMessage.count({where:{threadId:id}})]);});return {id,guestName:thread.guestName,contact:thread.contact,contactType:thread.contactType,status:thread.status,messages:await this.cards.decorate(messages.reverse()),olderAvailable:total>200,externalDeliveryAvailable:false};}
 @Post('support/guest/:id/messages')
 async guestMessage(@Param('id') id:string,@Headers('x-support-token') token:string,@Body() dto:MessageDto){const thread=await this.thread(id,token);await this.message(dto);return this.prisma.$transaction(async tx=>{if(await tx.supportMessage.count({where:{threadId:id,isModerator:false,createdAt:{gte:new Date(Date.now()-3600000)}}})>=30)throw new BadRequestException('Ліміт: 30 повідомлень на годину');const message=await tx.supportMessage.create({data:{threadId:id,text:dto.text,authorName:thread.guestName,profileUserId:dto.profileUserId}});await tx.supportThread.update({where:{id},data:{lastGuestAt:new Date(),lastSeenAt:new Date(),status:'OPEN'}});return {id:message.id};});}
 @Get('moderation/support') @UseGuards(JwtAuthGuard)
 async list(@Req() req:AuthenticatedRequest,@Query('status') status='OPEN',@Query('page') page='0'){
  await this.mod(req.user.id);if(!['OPEN','CLOSED','QUEUE','ALL'].includes(status))throw new BadRequestException('Некоректний статус');const offset=Math.max(0,Math.min(10000,Number.parseInt(page)||0));const where=status==='ALL'?{}:status==='QUEUE'?{messages:{some:{isModerator:true,deliveryStatus:'QUEUED'}}}:{status};
  const [items,total,queued]=await Promise.all([this.prisma.supportThread.findMany({where,select:{id:true,guestName:true,contact:true,contactType:true,status:true,lastSeenAt:true,lastGuestAt:true,lastModeratorAt:true,createdAt:true,updatedAt:true,messages:{orderBy:{createdAt:'desc'},take:1,select:{text:true,isModerator:true}},_count:{select:{messages:true}}},orderBy:{updatedAt:'desc'},take:30,skip:offset*30}),this.prisma.supportThread.count({where}),this.prisma.supportMessage.count({where:{isModerator:true,deliveryStatus:'QUEUED'}})]);return {items,total,queued,page:offset,externalDeliveryAvailable:false};
 }
 @Get('moderation/support/:id') @UseGuards(JwtAuthGuard)
 async details(@Req() req:AuthenticatedRequest,@Param('id') id:string){await this.mod(req.user.id);const thread=await this.prisma.supportThread.findUnique({where:{id},select:{id:true,guestName:true,contact:true,contactType:true,status:true,lastSeenAt:true,createdAt:true,messages:{orderBy:{createdAt:'asc'}}}});if(!thread)throw new NotFoundException('Чат не знайдено');return {...thread,messages:await this.cards.decorate(thread.messages)};}
 @Post('moderation/support/:id/messages') @UseGuards(JwtAuthGuard)
 async reply(@Req() req:AuthenticatedRequest,@Param('id') id:string,@Body() dto:MessageDto){await this.mod(req.user.id);await this.message(dto);return this.prisma.$transaction(async tx=>{const thread=await tx.supportThread.findUnique({where:{id}});if(!thread)throw new NotFoundException('Чат не знайдено');const actor=await tx.user.findUniqueOrThrow({where:{id:req.user.id},select:{name:true}});const message=await tx.supportMessage.create({data:{threadId:id,text:dto.text,authorId:req.user.id,authorName:actor.name,profileUserId:dto.profileUserId,isModerator:true,deliveryStatus:'QUEUED'}});await tx.supportThread.update({where:{id},data:{lastModeratorAt:new Date(),status:'OPEN'}});await this.access.log(req.user.id,null,'support.reply',id,'Відповідь у гостьовому чаті',{messageId:message.id},tx);return message;});}
 @Post('moderation/support/:id/status') @UseGuards(JwtAuthGuard)
 async status(@Req() req:AuthenticatedRequest,@Param('id') id:string,@Body() dto:StatusDto){await this.mod(req.user.id);if(!await this.prisma.supportThread.findUnique({where:{id},select:{id:true}}))throw new NotFoundException('Чат не знайдено');await this.prisma.supportThread.update({where:{id},data:{status:dto.status}});await this.access.log(req.user.id,null,'support.status',id,'Статус гостьового чату',{status:dto.status});return {status:dto.status};}
 @Post('moderation/support/:id/messages/:messageId/delivered') @UseGuards(JwtAuthGuard)
 async delivered(@Req() req:AuthenticatedRequest,@Param('id') id:string,@Param('messageId') messageId:string){await this.mod(req.user.id);const result=await this.prisma.supportMessage.updateMany({where:{id:messageId,threadId:id,isModerator:true,deliveryStatus:'QUEUED'},data:{deliveryStatus:'MANUAL'}});if(!result.count)throw new BadRequestException('Повідомлення не очікує ручної відповіді');await this.access.log(req.user.id,null,'support.delivery',id,'Відповідь передано вручну',{messageId});return {marked:true};}
}
