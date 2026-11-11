import { IsNumber, IsOptional, IsString, IsUUID, Min } from "class-validator";

export class AddFridgeItemDto {
  @IsUUID()
  ingredientId!: string;

  @IsOptional() @IsNumber() @Min(0, { message: "Кількість не може бути меншою за 0" })
  quantity?: number;

  @IsOptional() @IsString()
  unit?: string;
}
