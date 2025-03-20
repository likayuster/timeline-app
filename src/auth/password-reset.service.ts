import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { randomBytes } from 'crypto';
import { hashPassword } from './utils/password.utils';

@Injectable()
export class PasswordResetService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private configService: ConfigService,
    private mailService: MailService
  ) {}

  /**
   * パスワードリセットトークンを生成し、保存します
   * @param email ユーザーのメールアドレス
   * @returns 成功メッセージ（セキュリティ上の理由で常に成功を返します）
   */
  async generateResetToken(email: string): Promise<{
    message: string;
    token?: string;
    userId?: number;
  }> {
    // ユーザーの存在確認（メールアドレスによる）
    const user = await this.usersService.findByEmailOrUsername(email);

    // ユーザーが存在しなくても、セキュリティ上の理由から同じ応答を返す
    if (!user) {
      return {
        message:
          'パスワードリセット手順が送信されました（該当するアカウントが存在する場合）',
      };
    }

    // ランダムなトークンを生成（32バイト = 64文字の16進数文字列）
    const resetToken = randomBytes(32).toString('hex');

    // トークンの有効期限を設定（デフォルト: 1時間）
    const expiresInHours =
      this.configService.get<number>('auth.pßasswordResetExpiresInHours') || 1;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    // 既存のリセットトークンがある場合は削除
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    // 新しいリセットトークンをデータベースに保存
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: resetToken,
        expiresAt,
      },
    });

    // パスワードリセットメールを送信
    await this.mailService.sendPasswordResetEmail(
      user.email,
      resetToken,
      user.username
    );

    // トークンを返す（実際のアプリケーションではメール送信時に使用）
    // 注意: 本番環境ではこのトークンをレスポンスに含めないこと
    // 開発目的でのみ返しています
    return {
      message: 'パスワードリセット手順が送信されました',
      token: resetToken, // 開発用。本番環境では削除すること
      userId: user.id, // 開発用。本番環境では削除すること
    };
  }

  /**
   * パスワードリセットトークンを検証します
   * @param token リセットトークン
   * @returns 有効な場合はtrue
   */
  async validateResetToken(token: string): Promise<boolean> {
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token },
    });

    // トークンが存在しない、または有効期限切れの場合
    if (!resetToken || resetToken.expiresAt < new Date()) {
      return false;
    }

    return true;
  }

  /**
   * パスワードをリセットします
   * @param token リセットトークン
   * @param newPassword 新しいパスワード
   * @returns 成功メッセージ
   */
  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<{ message: string }> {
    // トークンの検証
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token },
    });

    // トークンが存在しない場合
    if (!resetToken) {
      throw new NotFoundException('無効または期限切れのトークンです');
    }

    // トークンの有効期限が切れている場合
    if (resetToken.expiresAt < new Date()) {
      // 期限切れのトークンを削除
      await this.prisma.passwordResetToken.delete({
        where: { id: resetToken.id },
      });
      throw new BadRequestException('トークンの有効期限が切れています');
    }

    // パスワードをハッシュ化
    const hashedPassword = await hashPassword(newPassword);

    // トランザクションを使用して、パスワード更新とトークン削除を原子的に実行
    await this.prisma.$transaction(async (prisma) => {
      // ユーザーのパスワードを更新
      await prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash: hashedPassword },
      });

      // 使用済みのリセットトークンを削除
      await prisma.passwordResetToken.delete({
        where: { id: resetToken.id },
      });
    });

    return { message: 'パスワードが正常にリセットされました' };
  }
}
