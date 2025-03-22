import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { User } from '@prisma/client';
import { VerifyCallback } from 'passport-google-oauth20';

// GitHub OAuthの設定型定義
interface GitHubOAuthConfig {
  clientID: string;
  clientSecret: string;
  callbackURL: string;
  scope: string[];
}

// GitHubプロファイル情報の型定義
interface GitHubProfile {
  id: string;
  displayName?: string;
  username?: string;
  profileUrl?: string;
  emails?: Array<{ value: string; primary?: boolean; verified?: boolean }>;
  photos?: Array<{ value: string }>;
  _json?: {
    avatar_url?: string;
    name?: string;
    bio?: string;
  };
  [key: string]: unknown;
}

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService
  ) {
    // 設定を取得
    const config: GitHubOAuthConfig = {
      clientID: configService.get<string>('auth.oauth.github.clientID') || '',
      clientSecret:
        configService.get<string>('auth.oauth.github.clientSecret') || '',
      callbackURL:
        configService.get<string>('auth.oauth.github.callbackURL') || '',
      scope: configService.get<string[]>('auth.oauth.github.scope') || [
        'user:email',
      ],
    };

    // 必須設定の検証
    if (!config.clientID || !config.clientSecret || !config.callbackURL) {
      throw new Error('GitHub OAuth 設定が不足しています');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super(config);
  }

  /**
   * GitHub認証後に呼び出されるバリデーションメソッド
   */
  async validate(
    accessToken: string,
    refreshToken: string,
    originalProfile: unknown,
    done: VerifyCallback
  ): Promise<void> {
    try {
      // プロファイルを適切な型にキャスト
      const profile = originalProfile as GitHubProfile;

      // メールアドレスの抽出（GitHubでは複数のメールを持っていることがある）
      // プライマリメールを優先的に使用
      let email: string | null = null;
      if (profile.emails && profile.emails.length > 0) {
        // プライマリメールを探す
        const primaryEmail = profile.emails.find((e) => e.primary);
        if (primaryEmail) {
          email = primaryEmail.value;
        } else {
          // プライマリメールがなければ最初のメールを使用
          email = profile.emails[0].value;
        }
      }

      // 必要な情報の抽出
      const username = profile.username || '';
      const displayName =
        profile.displayName || profile._json?.name || username;
      const profileImage =
        profile.photos?.[0]?.value || profile._json?.avatar_url || null;
      const bio = profile._json?.bio || null;
      const profileId = profile.id;

      if (!email) {
        return done(
          new Error(
            'GitHubアカウントからメールアドレスを取得できませんでした。メールのアクセス権限を確認してください。'
          ),
          undefined
        );
      }

      // 既存ユーザーの検索
      let user = await this.usersService.findByEmailOrUsername(email);

      if (!user) {
        // 新規ユーザー作成処理
        const suggestedUsername = username || email.split('@')[0];
        const randomPassword = this.generateSecurePassword();

        try {
          user = await this.createNewUser(
            email,
            suggestedUsername,
            displayName,
            profileImage,
            profileId,
            randomPassword,
            bio
          );
        } catch (error) {
          // ユーザー名の重複エラー処理
          if (this.isUsernameConflictError(error)) {
            const uniqueUsername = `${suggestedUsername}_gh${profileId.substring(0, 5)}`;
            user = await this.createNewUser(
              email,
              uniqueUsername,
              displayName,
              profileImage,
              profileId,
              randomPassword,
              bio
            );
          } else {
            throw error;
          }
        }
      } else {
        // 既存ユーザーのGitHub情報を更新
        await this.usersService.updateOAuthInfo(user.id, {
          provider: 'github',
          providerId: profileId,
        });

        // プロフィール情報も最新の情報で更新（任意）
        if (profileImage || bio) {
          await this.usersService.updateProfile(user.id, {
            profileImage: profileImage || undefined,
            bio: bio || undefined,
          });
        }
      }

      // 認証成功
      done(null, user);
    } catch (error) {
      // エラー処理
      const errorObj =
        error instanceof Error
          ? error
          : new Error('GitHub OAuth認証中に不明なエラーが発生しました');
      done(errorObj, undefined);
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
    password: string,
    bio: string | null = null
  ): Promise<User> {
    return this.usersService.createOAuthUser({
      email,
      username,
      displayName: displayName || undefined,
      profileImage: profileImage || undefined,
      provider: 'github',
      providerId,
      password,
      bio: bio || undefined,
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
