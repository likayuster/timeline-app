// ファイルの先頭に追加

import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';
import { hashPassword } from '../auth/utils/password.utils';

interface OAuthUserData {
  email: string;
  username: string;
  displayName?: string;
  profileImage?: string;
  provider: string;
  providerId: string;
  password: string; // ランダムパスワード
  bio?: string;
}

interface OAuthInfo {
  provider: string;
  providerId: string;
}

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
   * OAuthプロバイダーとIDでユーザーを検索します
   * @param provider プロバイダー名（google, github）
   * @param providerId プロバイダー側のユーザーID
   * @returns 見つかったユーザー、または null
   */
  async findByProvider(
    provider: string,
    providerId: string
  ): Promise<User | null> {
    try {
      // PrismaのWhere句では、明示的にフィールド名を指定する
      return await this.prisma.user.findFirst({
        where: {
          AND: [
            { provider: { equals: provider } },
            { providerId: { equals: providerId } },
          ],
        },
      });
    } catch (error) {
      console.error('OAuth検索中にエラーが発生しました:', error);
      return null;
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
   * OAuth認証を通じて新しいユーザーを作成します
   * @param userData OAuthユーザーデータ
   * @returns 作成されたユーザー
   */
  async createOAuthUser(userData: OAuthUserData): Promise<User> {
    // メールアドレスで既存ユーザーをチェック
    const existingUser = await this.findByEmailOrUsername(userData.email);

    if (existingUser) {
      // 既存ユーザーがあれば、OAuthプロバイダー情報を紐付け
      return this.updateOAuthInfo(existingUser.id, {
        provider: userData.provider,
        providerId: userData.providerId,
      });
    }

    // ユーザー名の重複をチェック
    const usernameExists = await this.findByEmailOrUsername(
      undefined,
      userData.username
    );
    if (usernameExists) {
      // ユーザー名が存在する場合は、プロバイダーIDを追加して一意にする
      userData.username = `${userData.username}_${userData.provider.substring(0, 1)}${userData.providerId.substring(0, 5)}`;
    }

    // パスワードをハッシュ化
    const passwordHash = await hashPassword(userData.password);

    // 新規ユーザーを作成
    return this.prisma.user.create({
      data: {
        email: userData.email,
        username: userData.username,
        passwordHash: passwordHash,
        displayName: userData.displayName || userData.username,
        profileImage: userData.profileImage,
        provider: userData.provider,
        providerId: userData.providerId,
      },
    });
  }

  /**
   * 既存ユーザーにOAuthプロバイダー情報を更新/追加します
   * @param userId ユーザーID
   * @param oauthInfo OAuthプロバイダー情報
   * @returns 更新されたユーザー
   */
  async updateOAuthInfo(userId: number, oauthInfo: OAuthInfo): Promise<User> {
    return await this.prisma.user.update({
      where: { id: userId },
      data: {
        provider: oauthInfo.provider,
        providerId: oauthInfo.providerId,
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
