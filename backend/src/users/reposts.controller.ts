import {Controller,Get,Param,Put,Req,UseGuards} from '@nestjs/common';
import {JwtAuthGuard,PublicRead,type AuthenticatedRequest} from '../auth/jwt-auth.guard';
import {PrismaService} from '../prisma/prisma.service';
import {ManagementService} from './management.service';
@Controller()
@UseGuards(JwtAuthGuard)
export class RepostsController {
 constructor(private readonly prisma:PrismaService,private readonly access:ManagementService){}
 @Get('library/reposts') @PublicRead()
 async counts(@Req() req:AuthenticatedRequest){const rows=await this.prisma.recipeRepost.groupBy({by:['recipeId'],where:{recipe:await this.access.readable(req.user.id)},_count:true});return rows.map(r=>({id:r.recipeId,count:r._count}));}
 @Put('recipes/:id/repost')
 async repost(@Req() req:AuthenticatedRequest,@Param('id') id:string){await this.access.recipe(req.user.id,id);await this.prisma.recipeRepost.upsert({where:{userId_recipeId:{userId:req.user.id,recipeId:id}},create:{userId:req.user.id,recipeId:id},update:{}});return {count:await this.prisma.recipeRepost.count({where:{recipeId:id}})};}
}
