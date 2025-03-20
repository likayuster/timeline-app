import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { RefreshTokenService } from './refresh-token.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { hashPassword, verifyPassword } from './utils/password.utils';
import { User } from '@prisma/client';

// JWT ペイロードの型定義
export interface JwtPayload {
  sub: number; // ユーザーID（subject）
  username?: string; // オプショナル: ユーザー名
  roles?: string[]; // オプショナル: ユーザーロール
  [key: string]: any; // その他の任意のプロパティ
}

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private usersService: UsersService, // UsersServiceを注入
    private refreshTokenService: RefreshTokenService
  ) {}

  /**
   * 新規ユーザーを登録します
   * @param registerDto ユーザー登録データ
   * @returns 登録されたユーザー情報とトークン
   */
  async register(registerDto: RegisterUserDto) {
    // 1. 同じメールアドレスまたはユーザー名のユーザーが存在するか確認
    const existingUser = await this.usersService.findByEmailOrUsername(
      registerDto.email,
      registerDto.username
    );

    if (existingUser) {
      throw new ConflictException(
        'このメールアドレスまたはユーザー名は既に使用されています'
      );
    }

    // 2. パスワードをハッシュ化
    const hashedPassword = await hashPassword(registerDto.password);

    // 3. ユーザーを作成
    const newUser: User = await this.usersService.create({
      email: registerDto.email,
      username: registerDto.username,
      passwordHash: hashedPassword,
      displayName: registerDto.displayName,
    });

    // トークン生成と保存
    const { accessToken, refreshToken } = this.generateTokens(newUser.id);

    // リフレッシュトークンをデータベースに保存（新しい処理）
    await this.refreshTokenService.createRefreshToken(newUser.id, refreshToken);

    // レスポンスの生成
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...userWithoutPassword } = newUser;

    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    };
  }

  /**
   * ユーザーログイン認証を行います
   * @param loginDto ログイン情報
   * @returns 認証されたユーザー情報とトークン
   */
  async login(loginDto: LoginUserDto) {
    // 1. ユーザーを検索
    const user: User | null = await this.usersService.findByEmailOrUsername(
      loginDto.usernameOrEmail,
      loginDto.usernameOrEmail
    );

    if (!user) {
      throw new UnauthorizedException('認証情報が正しくありません');
    }

    // 2. パスワードを検証
    const passwordValid = await verifyPassword(
      loginDto.password,
      user.passwordHash
    );

    if (!passwordValid) {
      throw new UnauthorizedException('認証情報が正しくありません');
    }

    // 3. トークンを生成
    // トークン生成
    const { accessToken, refreshToken } = this.generateTokens(user.id);

    // リフレッシュトークンをデータベースに保存（新しい処理）
    await this.refreshTokenService.createRefreshToken(user.id, refreshToken);

    // 4. レスポンスからパスワードを除外
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    };
  }

  /**
   * リフレッシュトークンを使用して新しいトークンペアを生成します
   * @param refreshToken 有効なリフレッシュトークン
   * @returns 新しいアクセストークンとリフレッシュトークン
   */
  async refreshTokens(refreshToken: string) {
    try {
      // 1. JWT としてのトークンを検証
      const payload = this.verifyToken(refreshToken, true);

      // 2. データベースでトークンを検証（新しい処理）
      const refreshTokenEntity =
        await this.refreshTokenService.validateRefreshToken(refreshToken);

      // JWT ペイロードのユーザーIDとデータベースのユーザーIDを比較して検証
      // これにより不正なトークンの使用をさらに防止できる
      if (payload.sub !== refreshTokenEntity.userId) {
        throw new UnauthorizedException('トークンのユーザーIDが一致しません');
      }

      // 3. 新しいトークンペアを生成
      const newTokens = this.generateTokens(refreshTokenEntity.userId);

      // 4. リフレッシュトークンをローテーション（セキュリティ強化）
      await this.refreshTokenService.rotateRefreshToken(
        refreshToken,
        refreshTokenEntity.userId,
        newTokens.refreshToken
      );

      return newTokens;
    } catch {
      throw new UnauthorizedException(
        '無効または期限切れのリフレッシュトークンです'
      );
    }
  }

  /**
   * ユーザーのログアウト処理を行います
   * @param refreshToken 無効化するリフレッシュトークン
   */
  async logout(refreshToken: string) {
    try {
      // リフレッシュトークンを無効化
      await this.refreshTokenService.revokeRefreshToken(refreshToken);
      return { success: true, message: 'ログアウトしました' };
    } catch {
      // トークンが見つからない場合も成功として扱う（冪等性）
      return { success: true, message: 'ログアウトしました' };
    }
  }

  /**
   * すべてのデバイスからログアウトします
   * @param userId ユーザーID
   */
  async logoutFromAllDevices(userId: number) {
    await this.refreshTokenService.revokeAllUserTokens(userId);
    return { success: true, message: 'すべてのデバイスからログアウトしました' };
  }

  /**
   * アクセストークンを生成します
   * @param payload JWTペイロード（ユーザーID、ロールなどを含む）
   * @returns 生成されたアクセストークン
   */
  generateAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload);
  }

  /**
   * リフレッシュトークンを生成します（アクセストークンとは別の秘密鍵と有効期限を使用）
   * @param payload JWTペイロード（通常はユーザーIDのみを含む）
   * @returns 生成されたリフレッシュトークン
   */
  generateRefreshToken(payload: { sub: number }): string {
    return this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.refreshSecret'),
      expiresIn: this.configService.get('jwt.refreshExpiresIn'),
    });
  }

  /**
   * トークンペアを生成します（アクセストークンとリフレッシュトークンの両方）
   * @param userId ユーザーID
   * @returns アクセストークンとリフレッシュトークンを含むオブジェクト
   */
  generateTokens(userId: number): {
    accessToken: string;
    refreshToken: string;
  } {
    const payload: JwtPayload = { sub: userId };

    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }

  /**
   * トークンを検証します
   * @param token 検証するトークン
   * @param isRefreshToken リフレッシュトークンかどうか
   * @returns 検証されたペイロード
   * @throws JwtService の検証に失敗した場合にエラーをスローします
   */
  verifyToken(token: string, isRefreshToken = false): JwtPayload {
    if (isRefreshToken) {
      return this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get('jwt.refreshSecret'),
      });
    }

    return this.jwtService.verify<JwtPayload>(token);
  }
}
