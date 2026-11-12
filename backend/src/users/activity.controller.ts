import {BadRequestException,Controller,ForbiddenException,Get,NotFoundException,Param,Query,Req,UseGuards} from '@nestjs/common';
import {JwtAuthGuard,type AuthenticatedRequest} from '../auth/jwt-auth.guard';
import {PrismaService} from '../prisma/prisma.service';
import {ManagementService,publicPerson} from './management.service';
@Controller()
@UseGuards(JwtAuthGuard)
export class ActivityController {
 constructor(private readonly prisma:PrismaService,private readonly access:ManagementService){}
 @Get('management/activity')
 async activity(@Req() req:AuthenticatedRequest,@Query() q:Record<string,string>){
  const moderator=await this.access.moderator(req.user.id);const ownerId=q.ownerId||(!moderator?req.user.id:undefined);
  if(q.subjectId&&!moderator)throw new ForbiddenException('Потрібні права модератора');
  if(!moderator&&ownerId!==req.user.id)throw new ForbiddenException('Журнал доступний лише власнику та модерації');
  const actors=(q.actors||'').split(',').filter(Boolean);if(actors.length>30)throw new BadRequestException('Забагато користувачів для порівняння');
  const from=q.fromAt?new Date(q.fromAt):q.from?new Date(q.from):null,to=q.toAt?new Date(q.toAt):q.to?new Date(q.to+'T23:59:59.999Z'):null;
  if((from&&!Number.isFinite(+from))||(to&&!Number.isFinite(+to)))throw new BadRequestException('Некоректна дата');
  if(from&&to&&from>to)throw new BadRequestException('Початок періоду має передувати його завершенню');
  const families:Record<string,string[]>={recipe:['recipe.'],comment:['comment.'],profile:['profile.'],grant:['grant.'],moderation:['account.','report.'],support:['support.']};
  if(q.category&&!families[q.category])throw new BadRequestException('Невідома категорія журналу');
  const conditions=[...(q.category?[{OR:families[q.category].map(prefix=>({action:{startsWith:prefix}}))}]:[]),...(q.subjectId?[{OR:[{actorId:q.subjectId},{ownerId:q.subjectId}]}]:[])];
  const where={...(conditions.length?{AND:conditions}:{}),...(ownerId?{ownerId}:{}),...(actors.length?{actorId:{in:actors}}:{}),...(q.action?{action:q.action}:{}),...(q.search?{OR:[{actorName:{contains:q.search.slice(0,100)}},{targetTitle:{contains:q.search.slice(0,100)}}]}:{}),...((from||to)?{createdAt:{...(from?{gte:from}:{}),...(to?{lte:to}:{})}}:{})};
  const page=Math.max(0,Math.min(100000,Number.parseInt(q.page||'0')||0));
  const [items,total,groups,people]=await Promise.all([
   this.prisma.auditEvent.findMany({where,orderBy:[{createdAt:q.sort==='oldest'?'asc':'desc'},{id:'desc'}],skip:page*50,take:50}),this.prisma.auditEvent.count({where}),
   this.prisma.auditEvent.groupBy({by:['actorId','action'],where,_count:true}),
   this.prisma.user.findMany({where:ownerId?{OR:[{id:ownerId},{adminGrants:{some:{ownerId}}},{id:{in:(await this.prisma.auditEvent.findMany({where:{ownerId},distinct:['actorId'],select:{actorId:true}})).map(e=>e.actorId)}}]}:{},select:publicPerson,orderBy:{name:'asc'}})
  ]);
  const moderators=moderator?[]:await this.prisma.user.findMany({where:{id:{in:items.map(e=>e.actorId)},role:'MODERATOR'},select:{id:true}});
  const redacted=items.map(e=>{const restricted=e.actorRole==='MODERATOR'||/^(account\.|report\.|support\.|profile\.(hide|restore)$)/.test(e.action)||moderators.some(m=>m.id===e.actorId);return {...e,details:!moderator&&restricted?null:e.details};});
  return {items:redacted,moderator,total,page,people,comparison:people.map(p=>({...p,total:groups.filter(g=>g.actorId===p.id).reduce((s,g)=>s+g._count,0),actions:groups.filter(g=>g.actorId===p.id).map(g=>({action:g.action,count:g._count}))}))};
 }
 @Get('moderation/overview')
 async overview(@Req() req:AuthenticatedRequest,@Query() q:Record<string,string>){
  if(!await this.access.moderator(req.user.id))throw new ForbiddenException('Потрібні права модератора');
  const search=(q.search||'').trim(),status=q.status||'ALL',sort=q.sort||'registered',direction=q.direction==='asc'?1:-1;
  if(!['ALL','ACTIVE','DELETED'].includes(status)||!['name','registered','rating','repostsReceived','repostsMade','comments','recipes','published','unpublished','reports','followers'].includes(sort))throw new BadRequestException('Некоректні фільтри');
  const from=q.from?new Date(q.from):null,to=q.to?new Date(q.to+'T23:59:59.999Z'):null;if((from&&!Number.isFinite(+from))||(to&&!Number.isFinite(+to)))throw new BadRequestException('Некоректна дата реєстрації');
  const [users,recipes,hiddenRecipes,comments,hiddenComments,ratings,grants,saved,following,history,rows,reports]=await Promise.all([
   this.prisma.user.count(),this.prisma.recipe.count(),this.prisma.recipe.count({where:{hiddenAt:{not:null}}}),this.prisma.comment.count({where:{deletedAt:null}}),this.prisma.comment.count({where:{hiddenAt:{not:null},deletedAt:null}}),this.prisma.rating.aggregate({_avg:{value:true},_count:true}),this.prisma.blogGrant.count(),this.prisma.favorite.count(),this.prisma.follow.count(),this.prisma.searchHistory.count(),
   this.prisma.user.findMany({where:{...(status==='ACTIVE'?{deletedAt:null}:status==='DELETED'?{deletedAt:{not:null}}:{}),...((from||to)?{createdAt:{...(from?{gte:from}:{}),...(to?{lte:to}:{})}}:{}),...(search?{OR:[{name:{contains:search.slice(0,100)}},{email:{contains:search.toLowerCase().slice(0,254)}},{handle:{contains:search.replace(/^@/,'').slice(0,100)}},{id:search}]}:{})},select:{...publicPerson,profile:{select:{avatarUrl:true,coverUrl:true}},role:true,createdAt:true,_count:{select:{recipes:true,comments:{where:{deletedAt:null}},ratings:true,followers:true,reposts:true}},recipes:{select:{isPublished:true,isShared:true,hiddenAt:true,ratings:{select:{value:true}},_count:{select:{reposts:true}}}}}}),this.prisma.report.groupBy({by:['targetUserId'],_count:true})
  ]);
  const people=rows.map(({recipes,...person})=>{const values=recipes.flatMap(r=>r.ratings.map(x=>x.value));return {...person,metrics:{rating:values.length?values.reduce((a,b)=>a+b,0)/values.length:null,ratingCount:values.length,repostsReceived:recipes.reduce((sum,r)=>sum+r._count.reposts,0),repostsMade:person._count.reposts,comments:person._count.comments,recipes:recipes.length,published:recipes.filter(r=>(r.isPublished||r.isShared)&&!r.hiddenAt).length,unpublished:recipes.filter(r=>(!r.isPublished&&!r.isShared)||!!r.hiddenAt).length,reports:reports.find(r=>r.targetUserId===person.id)?._count??0,followers:person._count.followers}};});
  people.sort((a,b)=>{const value=sort==='name'?a.name.localeCompare(b.name,'uk'):sort==='registered'?+a.createdAt-+b.createdAt:(a.metrics[sort as keyof typeof a.metrics]??-1)-(b.metrics[sort as keyof typeof b.metrics]??-1);return value*direction||a.name.localeCompare(b.name,'uk')||a.id.localeCompare(b.id);});
  const page=Math.max(0,Math.min(100000,Number.parseInt(q.page||'0')||0));
  return {users,recipes,hiddenRecipes,comments,hiddenComments,ratings:ratings._count,averageRating:ratings._avg.value,grants,saved,following,history,people:people.slice(page*30,(page+1)*30),matchedUsers:people.length,page};
 }
 @Get('moderation/users/:id')
 async user(@Req() req:AuthenticatedRequest,@Param('id') id:string){
  if(!await this.access.moderator(req.user.id))throw new ForbiddenException('Потрібні права модератора');
  const person=await this.prisma.user.findUnique({where:{id},select:{...publicPerson,role:true,createdAt:true,email:true,deletionReason:true}});if(!person)throw new NotFoundException('Користувача не знайдено');
  const [recipes,comments,saved,following,followers,ratings,byMeal,history,totalComments,communityComments,ratingsGiven,repostsMade,repostsReceived]=await Promise.all([
   this.prisma.recipe.findMany({where:{authorId:id},select:{id:true,title:true,emoji:true,imageUrl:true,hiddenAt:true,isPublished:true,isShared:true,createdAt:true},orderBy:{updatedAt:'desc'}}),
   this.prisma.comment.findMany({where:{userId:id,deletedAt:null},select:{id:true,text:true,createdAt:true,hiddenAt:true,recipe:{select:{id:true,title:true}}},orderBy:{createdAt:'desc'},take:200}),
   this.prisma.favorite.count({where:{userId:id}}),this.prisma.follow.count({where:{followerId:id}}),this.prisma.follow.count({where:{followingId:id}}),this.prisma.rating.aggregate({where:{recipe:{authorId:id}},_avg:{value:true},_count:true}),this.prisma.recipe.groupBy({where:{authorId:id},by:['mealType'],_count:true}),this.prisma.searchHistory.count({where:{userId:id}}),this.prisma.comment.count({where:{userId:id,deletedAt:null}}),this.prisma.comment.count({where:{userId:{not:id},deletedAt:null,recipe:{authorId:id}}}),this.prisma.rating.count({where:{userId:id}}),this.prisma.recipeRepost.count({where:{userId:id}}),this.prisma.recipeRepost.count({where:{recipe:{authorId:id}}})
  ]);return {repostsMade,repostsReceived,person,recipes,comments,saved,following,followers,history,totalComments,communityComments,ratingsGiven,averageRating:ratings._avg.value,ratingCount:ratings._count,byMeal};
 }
}
