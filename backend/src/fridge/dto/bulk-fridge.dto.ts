import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsUUID } from "class-validator";

export class BulkFridgeDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @ArrayUnique() @IsUUID(undefined, { each: true })
  ingredientIds!: string[];
}

export class RemoveFridgeItemsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @ArrayUnique() @IsUUID(undefined, { each: true })
  ids!: string[];
}
