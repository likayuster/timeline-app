import { IsNotEmpty, IsString } from 'class-validator';

export class LoginUserDto {
  @IsNotEmpty({ message: 'ユーザー名またはメールアドレスは必須です' })
  @IsString({
    message: 'ユーザー名またはメールアドレスは文字列である必要があります',
  })
  usernameOrEmail: string;

  @IsNotEmpty({ message: 'パスワードは必須です' })
  @IsString({ message: 'パスワードは文字列である必要があります' })
  password: string;
}
