import {ForbiddenException,Injectable,NotFoundException} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service';
export const publicPerson={id:true,name:true,handle:true,deletedAt:true,profileHiddenAt:true,profile:{select:{avatarUrl:true}}} as const;
export const publicRecipeFilter={hiddenAt:null,AND:[{OR:[{authorId:null},{author:{is:{profileHiddenAt:null}}}]}]};
export const rights=['editRecipes','hideRecipes','manageComments','editProfile'] as const;
export type Right=typeof rights[number];
export const rightNames={editRecipes:'Редагувати рецепти',hideRecipes:'Приховувати та відновлювати рецепти',manageComments:'Приховувати, відновлювати й закріплювати коментарі',editProfile:'Редагувати оформлення профілю'};
@Injectable()
export class ManagementService {
 constructor(readonly prisma:PrismaService){}
 async moderator(id:string){return (await this.prisma.user.findUnique({where:{id,deletedAt:null},select:{role:true}}))?.role==='MODERATOR';}
 async permissions(actorId:string,ownerId:string|null){
  const mod=await this.moderator(actorId),own=actorId===ownerId;
  const grant=ownerId&&!own?await this.prisma.blogGrant.findUnique({where:{ownerId_adminId:{ownerId,adminId:actorId}}}):null;
  return {editRecipes:mod||own||!!grant?.editRecipes,hideRecipes:mod||own||!!grant?.hideRecipes,manageComments:mod||own||!!grant?.manageComments,editProfile:mod||own||!!grant?.editProfile,moderator:mod,owner:own};
 }
 async require(actorId:string,ownerId:string|null,right:Right){const p=await this.permissions(actorId,ownerId);if(!p[right])throw new ForbiddenException('Немає дозволу на цю дію');return p;}
 async readable(actorId:string){
  if(await this.moderator(actorId))return {};
  const grants=await this.prisma.blogGrant.findMany({where:{adminId:actorId,OR:[{editRecipes:true},{hideRecipes:true},{manageComments:true}]},select:{ownerId:true}});
  return {OR:[{authorId:actorId},{authorId:{in:grants.map(g=>g.ownerId)}},{...publicRecipeFilter,OR:[{isPublished:true},{isShared:true}]}]};
 }
 async recipe(actorId:string,id:string){const r=await this.prisma.recipe.findFirst({where:{id,...await this.readable(actorId)}});if(!r)throw new NotFoundException('Рецепт не знайдено');return r;}
 async log(actorId:string,ownerId:string|null,action:string,targetId:string|null,targetTitle:string,details:unknown,client:any=this.prisma){const actor=await client.user.findUnique({where:{id:actorId},select:{name:true,role:true}});return client.auditEvent.create({data:{actorRole:actor?.role??'USER',actorId,actorName:actor?.name??'Користувач',ownerId,action,targetId,targetTitle,details:JSON.parse(JSON.stringify(details))}});}
 async notice(recipientId:string,title:string,text:string,ownerId:string|null,client:any=this.prisma){return client.accountNotice.create({data:{recipientId,title,text,ownerId}});}
}
