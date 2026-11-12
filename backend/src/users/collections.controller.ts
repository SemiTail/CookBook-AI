import {BadRequestException,Body,ConflictException,Controller,Delete,Get,NotFoundException,Param,Patch,Post,Put,Req,UseGuards} from '@nestjs/common';
import {Transform} from 'class-transformer';
import {ArrayMaxSize,ArrayMinSize,ArrayUnique,IsArray,IsString,Length} from 'class-validator';
import {PrismaService} from '../prisma/prisma.service';
import {JwtAuthGuard,type AuthenticatedRequest} from '../auth/jwt-auth.guard';
class NameDto {
 @Transform(({value})=>typeof value==='string'?value.normalize('NFKC').trim().replace(/\s+/g,' '):value)
 @IsString() @Length(1,60) name!:string;
}
class ItemsDto {
 @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ArrayUnique() @IsString({each:true}) @Length(1,100,{each:true}) ids!:string[];
}
@Controller('library/collections')
@UseGuards(JwtAuthGuard)
export class CollectionsController {
 constructor(private readonly prisma:PrismaService){}
 private async owned(client:any,userId:string,id:string){const row=await client.recipeCollection.findFirst({where:{id,userId}});if(!row)throw new NotFoundException('Колекцію не знайдено');return row;}
 private async unique<T>(operation:()=>Promise<T>){try{return await operation();}catch(e){if((e as {code?:string}).code==='P2002')throw new ConflictException('Колекція з такою назвою вже існує');throw e;}}
 @Get()
 async list(@Req() req:AuthenticatedRequest){const rows=await this.prisma.recipeCollection.findMany({where:{userId:req.user.id},orderBy:[{createdAt:'asc'},{id:'asc'}],include:{items:{select:{recipeId:true}}}});return rows.map(({items,nameKey,...row})=>({...row,recipeIds:items.map(i=>i.recipeId)}));}
 @Post()
 create(@Req() req:AuthenticatedRequest,@Body() dto:NameDto){return this.unique(()=>this.prisma.$transaction(async tx=>{if(await tx.recipeCollection.count({where:{userId:req.user.id}})>=50)throw new BadRequestException('Можна створити до 50 колекцій');return tx.recipeCollection.create({data:{userId:req.user.id,name:dto.name,nameKey:dto.name.toLocaleLowerCase('uk')}});}));}
 @Patch(':id')
 rename(@Req() req:AuthenticatedRequest,@Param('id') id:string,@Body() dto:NameDto){return this.unique(()=>this.prisma.$transaction(async tx=>{await this.owned(tx,req.user.id,id);return tx.recipeCollection.update({where:{id},data:{name:dto.name,nameKey:dto.name.toLocaleLowerCase('uk')}});}));}
 @Delete(':id')
 remove(@Req() req:AuthenticatedRequest,@Param('id') id:string){return this.prisma.$transaction(async tx=>{await this.owned(tx,req.user.id,id);await tx.recipeCollection.delete({where:{id}});return {deleted:true};});}
 @Put(':id/items')
 addItems(@Req() req:AuthenticatedRequest,@Param('id') id:string,@Body() dto:ItemsDto){return this.prisma.$transaction(async tx=>{await this.owned(tx,req.user.id,id);const saved=await tx.favorite.count({where:{userId:req.user.id,recipeId:{in:dto.ids}}});if(saved!==dto.ids.length)throw new BadRequestException('Додавати до колекції можна лише власні збережені рецепти');const existing=await tx.collectionItem.findMany({where:{collectionId:id,recipeId:{in:dto.ids}},select:{recipeId:true}});const known=new Set(existing.map(x=>x.recipeId));const ids=dto.ids.filter(x=>!known.has(x));if(ids.length)await tx.collectionItem.createMany({data:ids.map(recipeId=>({collectionId:id,userId:req.user.id,recipeId}))});return {added:ids.length};});}
 @Delete(':id/items')
 removeItems(@Req() req:AuthenticatedRequest,@Param('id') id:string,@Body() dto:ItemsDto){return this.prisma.$transaction(async tx=>{await this.owned(tx,req.user.id,id);return tx.collectionItem.deleteMany({where:{collectionId:id,userId:req.user.id,recipeId:{in:dto.ids}}});});}
}
