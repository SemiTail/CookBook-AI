import {ManagementService} from './management.service';
import {BadRequestException,Controller,Get,NotFoundException,Param,Put,Query,Req,UseGuards} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service';
import {JwtAuthGuard,type AuthenticatedRequest} from '../auth/jwt-auth.guard';
import {commentInclude,personSelect,recipeSelect} from './social.shared';
@Controller()
@UseGuards(JwtAuthGuard)
export class SocialController {
 constructor(private readonly prisma:PrismaService,private readonly access:ManagementService){}
 private visible(userId:string){return this.access.readable(userId);}
 @Get('users/mention-targets')
 async targets(@Req() req:AuthenticatedRequest,@Query('recipeId') recipeId:string,@Query('q') query=''){
  if(!recipeId||query.length>40)throw new BadRequestException('Некоректний пошук користувача');
  const recipe=await this.prisma.recipe.findFirst({where:{id:recipeId,...await this.visible(req.user.id)},select:{authorId:true,isShared:true,isPublished:true}});if(!recipe)throw new NotFoundException('Рецепт не знайдено');
  const q=query.normalize('NFKC').trim();
  return this.prisma.user.findMany({where:{deletedAt:null,profileHiddenAt:null,AND:[...(q?[{OR:[{handle:{contains:q.toLocaleLowerCase('uk')}},{name:{contains:q}}]}]:[]),...(!recipe.isShared&&!recipe.isPublished?[{OR:[{id:recipe.authorId??''},{role:'MODERATOR' as const}]}]:[])]},select:personSelect,orderBy:{handle:'asc'},take:10});
 }
 @Get('library/rated-recipes')
 async rated(@Req() req:AuthenticatedRequest){
  const rows=await this.prisma.recipe.findMany({where:{authorId:req.user.id,ratings:{some:{}}},select:{...recipeSelect,ratings:{select:{value:true}}}});
  return rows.map(({ratings,...recipe})=>({...recipe,averageRating:ratings.reduce((s,r)=>s+r.value,0)/ratings.length,ratingCount:ratings.length})).sort((a,b)=>b.averageRating-a.averageRating||b.ratingCount-a.ratingCount||a.title.localeCompare(b.title,'uk'));
 }
 @Get('library/comments/:kind')
 async comments(@Req() req:AuthenticatedRequest,@Param('kind') kind:string){
  if(!['mine','community'].includes(kind))throw new BadRequestException('Невідомий список коментарів');
  const filter=kind==='mine'?{userId:req.user.id,deletedAt:null,hiddenAt:null}:{userId:{not:req.user.id},deletedAt:null,hiddenAt:null};
  const rows=await this.prisma.recipe.findMany({where:{...(kind==='community'?{authorId:req.user.id}:await this.visible(req.user.id)),comments:{some:filter}},select:{...recipeSelect,comments:{where:filter,include:commentInclude,orderBy:{createdAt:'desc'}}},orderBy:{updatedAt:'desc'}});return rows.map(r=>({...r,comments:r.comments.map(c=>({...c,parent:c.parent?.hiddenAt?{...c.parent,text:''}:c.parent}))}));
 }
 @Get('library/mentions')
 async mentions(@Req() req:AuthenticatedRequest,@Query('cursor') cursor?:string){
  const where={recipientId:req.user.id,comment:{deletedAt:null,hiddenAt:null,recipe:await this.visible(req.user.id)}};
  if(cursor&&!await this.prisma.commentMention.findFirst({where:{...where,id:cursor},select:{id:true}}))throw new NotFoundException('Сповіщення не знайдено');
  const [rows,unread]=await Promise.all([this.prisma.commentMention.findMany({where,orderBy:[{createdAt:'desc'},{id:'desc'}],...(cursor?{cursor:{id:cursor},skip:1}:{}),take:21,include:{comment:{select:{id:true,text:true,recipeId:true,user:{select:personSelect},recipe:{select:{id:true,title:true,imageUrl:true,emoji:true}}}}}}),this.prisma.commentMention.count({where:{...where,readAt:null}})]);
  const items=rows.slice(0,20);return {items,unread,nextCursor:rows.length>20?items[items.length-1].id:null};
 }
 @Put('library/mentions/read-all')
 async readAll(@Req() req:AuthenticatedRequest){return this.prisma.commentMention.updateMany({where:{recipientId:req.user.id,readAt:null,comment:{deletedAt:null,hiddenAt:null,recipe:await this.visible(req.user.id)}},data:{readAt:new Date()}});}
 @Put('library/mentions/:id/read')
 async read(@Req() req:AuthenticatedRequest,@Param('id') id:string){const result=await this.prisma.commentMention.updateMany({where:{id,recipientId:req.user.id,comment:{deletedAt:null,hiddenAt:null,recipe:await this.visible(req.user.id)}},data:{readAt:new Date()}});if(!result.count)throw new NotFoundException('Сповіщення не знайдено');return {read:true};}
}
