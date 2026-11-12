import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested } from "class-validator";

const trim = ({ value }: { value: unknown }) => typeof value === "string" ? value.trim() : value;

export class RecipeIngredientDto {
  @IsUUID() ingredientId!: string;
  @IsOptional() @IsNumber() @Min(0) @Max(1000000) quantity?: number;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(30) unit?: string;
  @IsBoolean() optional!: boolean;
}

export class RecipeDto {
  @ValidateIf((_,value)=>value!==undefined) @IsBoolean() nutritionAuto?:boolean;
  @ValidateIf((_,value)=>value!==undefined) @IsUUID() authorId?: string;
  @ValidateIf((_, value) => value !== undefined) @IsIn(["ANY","BREAKFAST","LUNCH","DINNER","SNACK","DESSERT"]) mealType?: string;
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(160) title!: string;
  @Transform(trim) @IsString() @MaxLength(2000) description!: string;
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(20000) instructions!: string;
  @IsString() @MaxLength(32)
  @Matches(/^\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*$/u, { message: "Оберіть один емодзі для рецепта" })
  emoji!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(2048)
  @Matches(/^(?:https?:\/\/[^\s]+|\/api\/v1\/photos\/[0-9a-f-]{36})$/i, { message: "Вкажіть http/https-посилання або завантажте фото" })
  imageUrl?: string | null;
  @ValidateIf((_, value) => value !== undefined) @IsBoolean() isShared?: boolean;
  @ValidateIf((_, value) => value !== undefined) @IsBoolean() isPublished?: boolean;
  @IsInt() @Min(1) @Max(10080) preparationMinutes!: number;
  @IsInt() @Min(1) @Max(1000) servings!: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100000)
  calories?: number | null;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(10000)
  protein?: number | null;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(10000)
  fat?: number | null;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(10000)
  carbs?: number | null;
  @IsIn(["EASY", "MEDIUM", "HARD"]) difficulty!: "EASY" | "MEDIUM" | "HARD";
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100)
  @ValidateNested({ each: true }) @Type(() => RecipeIngredientDto)
  ingredients!: RecipeIngredientDto[];
}
