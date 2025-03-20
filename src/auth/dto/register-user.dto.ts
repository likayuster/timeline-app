import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class RegisterUserDto {
  @IsNotEmpty({ message: 'ユーザー名は必須です' })
  @IsString({ message: 'ユーザー名は文字列である必要があります' })
  @MinLength(3, { message: 'ユーザー名は3文字以上である必要があります' })
  @MaxLength(20, { message: 'ユーザー名は20文字以下である必要があります' })
  username: string;

  @IsNotEmpty({ message: 'メールアドレスは必須です' })
  @IsEmail({}, { message: '有効なメールアドレスを入力してください' })
  email: string;

  @IsNotEmpty({ message: 'パスワードは必須です' })
  @MinLength(8, { message: 'パスワードは8文字以上である必要があります' })
  @MaxLength(100, { message: 'パスワードは100文字以下である必要があります' })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'パスワードには少なくとも1つの大文字、小文字、数字または特殊文字が必要です',
  })
  password: string;

  @IsString()
  @MaxLength(100, { message: '表示名は100文字以下である必要があります' })
  displayName?: string;
}
