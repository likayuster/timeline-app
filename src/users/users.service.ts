// ファイルの先頭に追加

import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * メールアドレスまたはユーザー名でユーザーを検索します
   * @param email メールアドレス
   * @param username ユーザー名
   * @returns 見つかったユーザー、または null
   */
  async findByEmailOrUsername(
    email?: string,
    username?: string
  ): Promise<User | null> {
    // パラメータがない場合は早期リターン
    if (!email && !username) {
      return null;
    }

    try {
      // 明示的な型を持つシンプルなクエリを使用
      if (email) {
        // 型アサーションでTypeScriptにユーザー型であることを明示的に伝える
        // ESLint警告を一時的に無効化

        const user = await this.prisma.user.findFirst({
          where: { email },
        });

        if (user) {
          return user;
        }
      }

      if (username) {
        const user = await this.prisma.user.findFirst({
          where: { username },
        });

        return user;
      }

      return null;
    } catch (error) {
      // エラーログ記録などの処理を行う場合はここに実装
      console.error('ユーザー検索中にエラーが発生しました:', error);
      return null; // エラー時はnullを返す
    }
  }

  /**
   * IDでユーザーを検索します
   * @param id ユーザーID
   * @returns 見つかったユーザー
   * @throws NotFoundException ユーザーが見つからない場合
   */
  async findById(id: number): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`ID: ${id} のユーザーは存在しません`);
    }

    return user;
  }

  /**
   * 新しいユーザーを作成します
   * @param userData ユーザーデータ
   * @returns 作成されたユーザー
   * @throws ConflictException メールまたはユーザー名が既に使用されている場合
   */
  async create(userData: {
    email: string;
    username: string;
    passwordHash: string;
    displayName?: string;
  }): Promise<User> {
    // 既存ユーザーの確認
    const existingUser = await this.findByEmailOrUsername(
      userData.email,
      userData.username
    );

    if (existingUser) {
      if (existingUser.email === userData.email) {
        throw new ConflictException('このメールアドレスは既に使用されています');
      }
      throw new ConflictException('このユーザー名は既に使用されています');
    }

    // ユーザーの作成
    return this.prisma.user.create({
      data: {
        email: userData.email,
        username: userData.username,
        passwordHash: userData.passwordHash,
        displayName: userData.displayName || userData.username,
      },
    });
  }

  /**
   * パスワードをリセットします
   * @param userId ユーザーID
   * @param newPasswordHash 新しいハッシュ化パスワード
   * @returns 更新されたユーザー
   */
  async updatePassword(userId: number, newPasswordHash: string): Promise<User> {
    return await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });
  }

  /**
   * ユーザープロフィールを更新します
   * @param userId ユーザーID
   * @param profileData プロフィールデータ
   * @returns 更新されたユーザー
   */
  async updateProfile(
    userId: number,
    profileData: {
      displayName?: string;
      bio?: string;
      profileImage?: string;
    }
  ): Promise<User> {
    return await this.prisma.user.update({
      where: { id: userId },
      data: profileData,
    });
  }
}
