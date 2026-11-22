import { Transform } from "class-transformer";
import { IsNumber, IsOptional, IsString, IsUUID, Min, ValidateIf } from "class-validator";

export class AddFridgeItemDto {
  @IsUUID()
  ingredientId!: string;

  @IsOptional() @IsNumber() @Min(0, { message: "Кількість не може бути меншою за 0" })
  quantity?: number;

  @IsOptional() @IsString()
  unit?: string;
}

export class UpdateFridgeStockDto {
  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  @Min(0, { message: "Кількість не може бути меншою за 0" })
  quantity!: number | null;

  @Transform(({ value }) => typeof value === "string" ? value.trim() || null : value)
  @ValidateIf((_, value) => value !== null)
  @IsString()
  unit!: string | null;
}
