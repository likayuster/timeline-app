import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { User } from '@prisma/client';

// GoogleのOAuth設定の型を定義
interface GoogleOAuthConfig {
  clientID: string;
  clientSecret: string;
  callbackURL: string;
  scope: string[];
}

// Google Profile の型を明確に定義
interface GoogleProfile {
  id: string;
  displayName?: string;
  name?: {
    givenName?: string;
    familyName?: string;
  };
  emails?: Array<{ value: string; verified?: boolean }>;
  photos?: Array<{ value: string }>;
  [key: string]: unknown;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService
  ) {
    // 設定値を取得
    const config: GoogleOAuthConfig = {
      clientID: configService.get<string>('auth.oauth.google.clientID') || '',
      clientSecret:
        configService.get<string>('auth.oauth.google.clientSecret') || '',
      callbackURL:
        configService.get<string>('auth.oauth.google.callbackURL') || '',
      scope: configService.get<string[]>('auth.oauth.google.scope') || [
        'email',
        'profile',
      ],
    };

    // 必須設定の検証
    if (!config.clientID || !config.clientSecret || !config.callbackURL) {
      throw new Error('Google OAuth 設定が不足しています');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super(config);
  }

  /**
   * Google認証後に呼び出されるバリデーションメソッド
   * ユーザープロファイル情報を処理し、アプリケーションユーザーを返します
   */
  async validate(
    accessToken: string,
    refreshToken: string,
    originalProfile: unknown,
    done: VerifyCallback
  ): Promise<void> {
    try {
      // プロファイルを適切な型にキャスト
      const profile = originalProfile as GoogleProfile;

      // メールアドレスの抽出
      const email = profile.emails?.[0]?.value || null;

      // 名前情報の抽出
      const firstName = profile.name?.givenName || '';
      const lastName = profile.name?.familyName || '';

      // 表示名の設定
      const displayName =
        profile.displayName || `${firstName} ${lastName}`.trim();

      // プロフィール画像の取得
      const profileImage = profile.photos?.[0]?.value || null;

      // プロファイルIDの確保
      const profileId = profile.id;

      if (!email) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
        return done(
          new Error('Googleアカウントからメールアドレスを取得できませんでした'),
          undefined
        );
      }

      // 既存ユーザーの検索
      let user = await this.usersService.findByEmailOrUsername(email);

      if (!user) {
        // 新規ユーザー作成処理
        const username = email.split('@')[0];
        const randomPassword = this.generateSecurePassword();

        try {
          user = await this.createNewUser(
            email,
            username,
            displayName,
            profileImage,
            profileId,
            randomPassword
          );
        } catch (error) {
          // ユーザー名の重複エラー処理
          if (this.isUsernameConflictError(error)) {
            const uniqueUsername = `${username}_g${profileId.substring(0, 5)}`;
            user = await this.createNewUser(
              email,
              uniqueUsername,
              displayName,
              profileImage,
              profileId,
              randomPassword
            );
          } else {
            throw error;
          }
        }
      } else {
        // 既存ユーザーのOAuth情報を更新
        await this.usersService.updateOAuthInfo(user.id, {
          provider: 'google',
          providerId: profileId,
        });
      }

      // 認証成功
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
      return done(null, user);
    } catch (error) {
      // エラー処理
      const errorObj =
        error instanceof Error
          ? error
          : new Error('OAuth認証中に不明なエラーが発生しました');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
      return done(errorObj, undefined);
    }
  }

  /**
   * 新規ユーザーを作成するヘルパーメソッド
   */
  private async createNewUser(
    email: string,
    username: string,
    displayName: string | null,
    profileImage: string | null,
    providerId: string,
    password: string
  ): Promise<User> {
    return this.usersService.createOAuthUser({
      email,
      username,
      displayName: displayName || undefined,
      profileImage: profileImage || undefined,
      provider: 'google',
      providerId,
      password,
    });
  }

  /**
   * ユーザー名の重複エラーかどうかを判定
   */
  private isUsernameConflictError(error: unknown): boolean {
    if (error instanceof Error) {
      return (
        error.message.includes('username') && error.message.includes('already')
      );
    }

    if (typeof error === 'object' && error !== null && 'message' in error) {
      const message = String(error.message);
      return message.includes('username') && message.includes('already');
    }

    return false;
  }

  /**
   * 安全なランダムパスワードを生成
   */
  private generateSecurePassword(): string {
    // より安全なランダムパスワード生成
    const randomString = Math.random().toString(36).substring(2);
    const timestamp = Date.now().toString(36);
    return `${randomString}${timestamp}`.substring(0, 12);
  }
}
