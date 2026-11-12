import {BadRequestException,Injectable,NotFoundException} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service';
import {publicRecipeFilter} from './management.service';
@Injectable()
export class ProfileCardService {
 constructor(private readonly prisma:PrismaService){}
 async lookup(target:string){const clean=target?.normalize('NFKC').trim();if(!clean||clean.length<3||clean.length>100)throw new BadRequestException('Вкажіть ID або @нік профілю');const user=await this.prisma.user.findFirst({where:{profileHiddenAt:null,OR:[{id:clean},{handle:clean.replace(/^@/,'').toLocaleLowerCase('uk')}]},select:{id:true}});const card=user?await this.card(user.id):null;if(!card)throw new NotFoundException('Публічний профіль не знайдено');return card;}
 async search(target:string){const clean=target?.normalize('NFKC').trim().replace(/^@/,'');if(!clean||clean.length<3||clean.length>100)throw new BadRequestException('Вкажіть щонайменше 3 символи');const history=await this.prisma.previousHandle.findMany({where:{OR:[{handle:clean.toLocaleLowerCase('uk')},{name:clean}]},select:{userId:true,handle:true}});const users=await this.prisma.user.findMany({where:{profileHiddenAt:null,OR:[{id:clean},{handle:clean.toLocaleLowerCase('uk')},{name:clean},{id:{in:history.map(h=>h.userId)}}]},select:{id:true},take:100,orderBy:{createdAt:'desc'}});return Promise.all(users.map(async u=>({...await this.card(u.id),previousHandles:history.filter(h=>h.userId===u.id).map(h=>h.handle)})));}
 async card(id:string){
  const person=await this.prisma.user.findFirst({where:{id,profileHiddenAt:null},select:{id:true,name:true,handle:true,deletedAt:true,profile:{select:{avatarUrl:true,coverUrl:true,showRecipes:true}}}});if(!person)return null;
  const where={authorId:id,...publicRecipeFilter};
  const [recipes,ratings,followers,following]=await Promise.all([this.prisma.recipe.count({where:{...where,OR:[{isPublished:true},{isShared:true}]}}),this.prisma.rating.aggregate({where:{recipe:{...where,OR:[{isPublished:true},{isShared:true}]}},_avg:{value:true},_count:true}),this.prisma.follow.count({where:{followingId:id}}),this.prisma.follow.count({where:{followerId:id}})]);
  return {...person,recipeCount:recipes,averageRating:ratings._avg.value,ratingCount:ratings._count,followers,following};
 }
 async decorate<T extends {profileUserId:string|null}>(messages:T[]){const ids=[...new Set(messages.map(m=>m.profileUserId).filter((id):id is string=>!!id))];const cards=await Promise.all(ids.map(async id=>[id,await this.card(id)] as const));const map=new Map(cards);return messages.map(m=>({...m,profileCard:m.profileUserId?map.get(m.profileUserId)??null:null}));}
}
