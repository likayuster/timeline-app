import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RefreshTokenService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService
  ) {}

  /**
   * 新しいリフレッシュトークンを作成し、データベースに保存します
   * @param userId ユーザーID
   * @param token リフレッシュトークン文字列
   * @returns 保存されたリフレッシュトークン
   */
  async createRefreshToken(userId: number, token: string) {
    // トークンの有効期限を計算
    const refreshTokenExpiresIn =
      this.configService.get<string>('jwt.refreshExpiresIn') || '7d';
    const expiresIn = this.parseJwtExpirationTime(refreshTokenExpiresIn);

    // 有効期限の日時を計算
    const expiresAt = new Date();
    expiresAt.setTime(expiresAt.getTime() + expiresIn * 1000);

    // リフレッシュトークンをデータベースに保存
    return this.prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });
  }

  /**
   * リフレッシュトークンの有効性を検証します
   * @param token リフレッシュトークン
   * @returns 有効なリフレッシュトークン、または例外
   */
  async validateRefreshToken(token: string) {
    // データベースからトークンを検索
    const refreshToken = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    // トークンが存在しない場合
    if (!refreshToken) {
      throw new UnauthorizedException('無効なリフレッシュトークンです');
    }

    // トークンが無効化されている場合
    if (refreshToken.isRevoked) {
      // セキュリティリスク: すべてのトークンを無効化（トークン漏洩の可能性）
      await this.revokeAllUserTokens(refreshToken.userId);
      throw new UnauthorizedException(
        'リフレッシュトークンが無効化されています'
      );
    }

    // トークンの有効期限が切れている場合
    if (new Date() > refreshToken.expiresAt) {
      throw new UnauthorizedException(
        'リフレッシュトークンの有効期限が切れています'
      );
    }

    return refreshToken;
  }

  /**
   * 特定のリフレッシュトークンを無効化します（ログアウト時など）
   * @param token リフレッシュトークン
   */
  async revokeRefreshToken(token: string) {
    await this.prisma.refreshToken.update({
      where: { token },
      data: { isRevoked: true },
    });
  }

  /**
   * ユーザーのすべてのリフレッシュトークンを無効化します（セキュリティ侵害時など）
   * @param userId ユーザーID
   */
  async revokeAllUserTokens(userId: number) {
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });
  }

  /**
   * リフレッシュトークンを使用したらデータベースで使用済みとしてマークします
   * これにより、同じトークンが複数回使用されるのを防ぎます（トークン漏洩検出）
   * @param token リフレッシュトークン
   * @param userId ユーザーID
   * @returns 新しく生成されたリフレッシュトークン
   */
  async rotateRefreshToken(token: string, userId: number, newToken: string) {
    // トランザクションを使用して、古いトークンの無効化と新しいトークンの作成をアトミックに行う
    return this.prisma.$transaction(async (prisma) => {
      // 1. 古いトークンを無効化
      await prisma.refreshToken.update({
        where: { token },
        data: { isRevoked: true },
      });

      // 2. リフレッシュトークンの有効期限を計算
      const refreshTokenExpiresIn =
        this.configService.get<string>('jwt.refreshExpiresIn') || '7d';
      const expiresIn = this.parseJwtExpirationTime(refreshTokenExpiresIn);

      // 有効期限の日時を計算
      const expiresAt = new Date();
      expiresAt.setTime(expiresAt.getTime() + expiresIn * 1000);

      // 3. 新しいリフレッシュトークンを作成
      return prisma.refreshToken.create({
        data: {
          userId,
          token: newToken,
          expiresAt,
        },
      });
    });
  }

  /**
   * JWTの有効期間文字列（'7d', '24h'など）をセカンド単位に変換
   * @param expiresIn JWT有効期間文字列
   * @returns 秒単位の有効期間
   */
  private parseJwtExpirationTime(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhdwy])$/);
    if (!match) {
      return 60 * 60 * 24 * 7; // デフォルト: 7日間
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 60 * 60 * 24;
      case 'w':
        return value * 60 * 60 * 24 * 7;
      case 'y':
        return value * 60 * 60 * 24 * 365;
      default:
        return 60 * 60 * 24 * 7;
    }
  }
}
