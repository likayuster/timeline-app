import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { User } from '@prisma/client';

// JWTペイロードの型定義
export interface JwtPayload {
  sub: number; // ユーザーID
  username?: string; // ユーザー名（オプション）
  roles?: string[]; // ユーザーロール（オプション）
  iat?: number; // 発行時刻
  exp?: number; // 有効期限
  [key: string]: any; // その他の任意のプロパティ
}

// 動的なプロパティアクセスのための型
type DynamicUser = User & {
  [key: string]: any; // 任意の追加プロパティを許可
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService
  ) {
    const jwtSecret = configService.get<string>('jwt.accessSecret');

    // JWT シークレットが設定されていない場合、明示的にエラーを発生させる
    if (!jwtSecret) {
      throw new Error(
        'JWT アクセストークンのシークレットキーが環境変数に設定されていません'
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  /**
   * JWTペイロードを検証して、認証されたユーザーを返します
   * このメソッドは、PassportによってJWTが正常に検証された後に呼び出されます
   *
   * @param payload 検証済みのJWTペイロード
   * @returns 認証されたユーザー情報（リクエストのuser属性に設定されます）
   */
  async validate(payload: JwtPayload): Promise<any> {
    try {
      // ペイロードからユーザーIDを取得
      const userId = payload.sub;

      if (!userId) {
        throw new UnauthorizedException('Invalid token payload');
      }

      // ユーザーIDを使ってデータベースからユーザー情報を取得
      const userFromDb = await this.usersService.findById(userId);

      if (!userFromDb) {
        throw new UnauthorizedException('User not found');
      }

      // インデックスシグネチャを使用して型安全にアクセス
      const user = userFromDb as DynamicUser;

      // 型安全なプロパティ存在チェックと値のチェック
      if ('isActive' in user && user.isActive === false) {
        throw new UnauthorizedException('User account is deactivated');
      }

      // リクエストのユーザーオブジェクトとして返す
      // パスワードハッシュなどの機密情報は除外
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash, ...result } = user;

      // ペイロードからロール情報を追加（存在する場合）
      if (payload.roles) {
        result.roles = payload.roles;
      }

      return result;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Token validation failed');
    }
  }
}
