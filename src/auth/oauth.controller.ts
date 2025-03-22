import {
  Controller,
  Get,
  UseGuards,
  Req,
  Res,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';

// より明確なユーザー型を定義
interface AuthUser {
  id: number;
  // 他の必要なプロパティ
  email?: string;
  username?: string;
}

// OAuth認証で拡張されたリクエスト型
interface OAuthRequest extends Request {
  user?: AuthUser;
}

@Controller('auth')
export class OAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Google認証の開始エンドポイント
   * ユーザーはこのURLにアクセスするとGoogleのログイン画面にリダイレクトされます
   */
  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    // このメソッドは実行されません - GoogleのOAuth画面にリダイレクトされます
    // PassportのGuardが処理を引き継ぎます
  }

  /**
   * Google認証のコールバックエンドポイント
   * Google認証後、ユーザーはこのURLにリダイレクトされます
   */
  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  googleAuthCallback(@Req() req: OAuthRequest, @Res() res: Response) {
    return this.handleOAuthCallback(req, res, 'google');
  }

  /**
   * GitHub認証の開始エンドポイント
   * ユーザーはこのURLにアクセスするとGitHubのログイン画面にリダイレクトされます
   */
  @Public()
  @Get('github')
  @UseGuards(AuthGuard('github'))
  githubAuth() {
    // このメソッドは実行されません - GitHubのOAuth画面にリダイレクトされます
  }

  /**
   * GitHub認証のコールバックエンドポイント
   * GitHub認証後、ユーザーはこのURLにリダイレクトされます
   */
  @Public()
  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  githubAuthCallback(@Req() req: OAuthRequest, @Res() res: Response) {
    return this.handleOAuthCallback(req, res, 'github');
  }

  /**
   * OAuth認証後の共通処理
   * JWTトークンの生成とフロントエンドへのリダイレクトを行います
   */
  private handleOAuthCallback(
    req: OAuthRequest,
    res: Response,
    provider: string
  ) {
    try {
      // Passport認証を通過すると、req.userにユーザー情報が格納されています
      if (!req.user || !req.user.id) {
        throw new UnauthorizedException('認証に失敗しました');
      }

      // JWTトークンを生成
      const { accessToken, refreshToken } = this.authService.generateTokens(
        req.user.id
      );

      // リダイレクト先のURLを取得
      const successRedirect = this.configService.get<string>(
        'auth.oauth.successRedirect'
      );

      // フロントエンドアプリケーションへリダイレクト
      // トークンをURLパラメータとして渡す（より安全な方法はクッキーやセッションを使用）
      return res.redirect(
        HttpStatus.TEMPORARY_REDIRECT,
        `${successRedirect}?access_token=${accessToken}&refresh_token=${refreshToken}&provider=${provider}`
      );
    } catch (error) {
      console.error(`OAuth認証エラー (${provider}):`, error);

      // 認証失敗時のリダイレクト先
      const failureRedirect = this.configService.get<string>(
        'auth.oauth.failureRedirect'
      );

      // エラーメッセージを含めてリダイレクト
      const errorMsg = encodeURIComponent(
        error instanceof Error
          ? error.message
          : '認証処理中にエラーが発生しました'
      );

      return res.redirect(
        HttpStatus.TEMPORARY_REDIRECT,
        `${failureRedirect}?error=${errorMsg}`
      );
    }
  }
}
