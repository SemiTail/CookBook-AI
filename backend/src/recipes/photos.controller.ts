import { BadRequestException, Controller, Get, NotFoundException, Param, PayloadTooLargeException, Post, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import sharp from "sharp";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("photos")
export class PhotosController {
 constructor(private readonly prisma:PrismaService) {}
 @Post()
 @UseGuards(JwtAuthGuard)
 @UseInterceptors(FileInterceptor("photo",{limits:{fileSize:2500001,files:1,fields:0}}))
 async upload(@UploadedFile() file?:{buffer:Buffer;size:number}) {
  if(!file?.buffer.length)throw new BadRequestException("Оберіть фото JPG, PNG або WebP до 2,5 МБ");
  if(file.size>2500000)throw new PayloadTooLargeException("Фото перевищує допустимі 2,5 МБ");
  let data:Buffer;
  try {
    const image=sharp(file.buffer,{limitInputPixels:25000000,failOn:"warning"});
    const metadata=await image.metadata();
    if(!["jpeg","png","webp"].includes(metadata.format??"")||(metadata.pages??1)>1)throw new Error("Unsupported image");
    data=await image.rotate().resize({width:2048,height:2048,fit:"inside",withoutEnlargement:true}).webp({quality:85}).toBuffer();
  } catch {throw new BadRequestException("Некоректне зображення. Завантажте звичайне фото JPG, PNG або WebP до 2,5 МБ");}
  const photo=await this.prisma.recipePhoto.create({data:{data:new Uint8Array(data)},select:{id:true}});
  return {imageUrl:"/api/v1/photos/"+photo.id};
 }
 @Get(":id")
 async image(@Param("id") id:string,@Res() response:Response) {
   const photo=await this.prisma.recipePhoto.findUnique({where:{id}});
   if(!photo)throw new NotFoundException("Фото не знайдено");
   response.set({"Content-Type":"image/webp","X-Content-Type-Options":"nosniff","Cache-Control":"public, max-age=31536000, immutable"});
   response.send(Buffer.from(photo.data));
 }
}
