import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";
import { Transform } from "class-transformer";

export class RegisterDto {
  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsString() @MinLength(2) @MaxLength(80)
  name!: string;

  @Transform(({ value }) => typeof value === "string" ? value.trim().toLowerCase() : value)
  @IsEmail() @MaxLength(254)
  email!: string;

  @IsString() @MinLength(8) @MaxLength(128)
  password!: string;
}
