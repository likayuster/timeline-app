import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser, UserPayload } from './decorators/current-user.decorator';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';

// DTOクラスをコントローラーファイル内で直接定義
class RefreshTokenDto {
  refreshToken: string;
}

class LogoutDto {
  refreshToken: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 新規ユーザー登録（サインアップ）エンドポイント
   * @param registerDto 登録情報
   * @returns 登録されたユーザー情報とトークン
   */
  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterUserDto) {
    return this.authService.register(registerDto);
  }

  /**
   * ログインエンドポイント
   * @param loginDto ログイン情報
   * @returns 認証されたユーザー情報とトークン
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginUserDto) {
    // メソッド名とパラメータ型を修正
    return this.authService.login(loginDto); // 呼び出すメソッドを修正
  }

  /**
   * リフレッシュトークンを使用して新しいトークンを取得するエンドポイント
   * @param refreshTokenDto リフレッシュトークン
   * @returns 新しいトークンペア
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshTokens(refreshTokenDto.refreshToken);
  }

  /**
   * ログアウトエンドポイント - 現在のデバイスのセッションを終了します
   * @param logoutDto ログアウト情報（リフレッシュトークン）
   * @returns 成功メッセージ
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() logoutDto: LogoutDto) {
    return this.authService.logout(logoutDto.refreshToken);
  }

  /**
   * 全デバイスからのログアウトエンドポイント - すべてのセッションを終了します
   * @param user 現在の認証済みユーザー
   * @returns 成功メッセージ
   */
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutFromAllDevices(@CurrentUser() user: UserPayload) {
    // 明示的にnumber型に変換
    return this.authService.logoutFromAllDevices(Number(user.sub));
  }

  /**
   * 公開エンドポイント - 認証なしでアクセス可能
   * @Public デコレーターにより認証チェックをスキップ
   */
  @Public()
  @Get('public')
  getPublicRoute(): { message: string } {
    return { message: '誰でもアクセスできる公開エンドポイントです' };
  }

  /**
   * 保護されたエンドポイント - JWT認証が必要
   * JwtAuthGuardにより保護されています
   */
  @UseGuards(JwtAuthGuard)
  @Get('protected')
  getProtectedRoute(@CurrentUser() user: UserPayload): {
    message: string;
    user: UserPayload;
  } {
    return {
      message: '認証済みユーザーのみアクセスできる保護されたエンドポイントです',
      user,
    };
  }

  /**
   * テスト用のトークン生成エンドポイント
   * 実際のアプリケーションでは、ログイン機能で置き換えます
   */
  @Public()
  @Post('test-token')
  generateTestToken(): { accessToken: string; refreshToken: string } {
    // 仮のユーザーID: 1 でテスト用トークンを生成
    return this.authService.generateTokens(1);
  }
}
