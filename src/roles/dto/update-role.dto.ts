import { IsString, IsArray, IsOptional } from 'class-validator';

export class UpdateRoleDto {
  @IsOptional()
  @IsString({ message: 'ロール名は文字列で指定してください' })
  name?: string;

  @IsOptional()
  @IsString({ message: '説明は文字列で指定してください' })
  description?: string;

  @IsOptional()
  @IsArray({ message: '権限は配列で指定してください' })
  @IsString({ each: true, message: '権限は文字列で指定してください' })
  permissions?: string[];
}
