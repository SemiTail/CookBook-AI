import {Body,ConflictException,Controller,Get,Param,Put,Req,UseGuards} from '@nestjs/common';
import {IsInt,IsString,Max,MaxLength,Min} from 'class-validator';
import {PrismaService} from '../prisma/prisma.service';
import {ManagementService} from './management.service';
import {JwtAuthGuard,type AuthenticatedRequest} from '../auth/jwt-auth.guard';
class NoteDto {
 @IsString() @MaxLength(10000) text!:string;
 @IsInt() @Min(0) @Max(2147483646) revision!:number;
}
const conflict=()=>new ConflictException('Нотатку вже змінено в іншій вкладці або на іншому пристрої. Завантажте актуальну версію; ваш текст залишився у полі.');
@Controller('recipes/:recipeId/note')
@UseGuards(JwtAuthGuard)
export class RecipeNotesController {
 constructor(private readonly prisma:PrismaService,private readonly access:ManagementService){}
 @Get()
 async read(@Req() req:AuthenticatedRequest,@Param('recipeId') recipeId:string){await this.access.recipe(req.user.id,recipeId);return await this.prisma.recipeNote.findUnique({where:{userId_recipeId:{userId:req.user.id,recipeId}},select:{text:true,revision:true,updatedAt:true}})??{text:'',revision:0,updatedAt:null};}
 @Put()
 async save(@Req() req:AuthenticatedRequest,@Param('recipeId') recipeId:string,@Body() dto:NoteDto){
  await this.access.recipe(req.user.id,recipeId);
  try{return await this.prisma.$transaction(async tx=>{const where={userId_recipeId:{userId:req.user.id,recipeId}},current=await tx.recipeNote.findUnique({where});if((current?.revision??0)!==dto.revision)throw conflict();return current?tx.recipeNote.update({where,data:{text:dto.text,revision:{increment:1}},select:{text:true,revision:true,updatedAt:true}}):tx.recipeNote.create({data:{userId:req.user.id,recipeId,text:dto.text},select:{text:true,revision:true,updatedAt:true}});});}
  catch(e){if((e as {code?:string}).code==='P2002')throw conflict();throw e;}
 }
}
