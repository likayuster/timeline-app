import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { Request } from 'express'; // Expressのリクエスト型をインポート

// ユーザーオブジェクトの型を定義
interface UserInfo {
  userId?: number;
  sub?: number;
  id?: number;
  [key: string]: any; // その他のプロパティに対応
}

// リクエストに認証済みユーザー情報を含む拡張型
interface RequestWithUser extends Request {
  user?: UserInfo;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(PrismaService) private prisma: PrismaService
  ) {}

  /**
   * ユーザーがエンドポイントにアクセスできるかどうかを判断します
   * @param context 実行コンテキスト
   * @returns アクセスが許可される場合はtrue、それ以外はfalse
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // エンドポイントに必要なロールをメタデータから取得
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [
        context.getHandler(), // メソッドレベルのメタデータ
        context.getClass(), // クラスレベルのメタデータ
      ]
    );

    // ロールが指定されていない場合はアクセスを許可
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // リクエストからユーザー情報を取得（型指定）
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    // ユーザーが認証されていない場合
    if (!user) {
      throw new UnauthorizedException('認証が必要です');
    }

    // ユーザーIDを安全に取得
    const userId = user.userId || user.sub || user.id;

    // ユーザーIDがない場合
    if (userId === undefined) {
      throw new UnauthorizedException('有効なユーザーIDがありません');
    }

    // ユーザーのロールを取得
    const userRoles = await this.getUserRoles(userId);

    // ユーザーが必要なロールのいずれかを持っているかチェック
    const hasRequiredRole = requiredRoles.some((role) =>
      userRoles.includes(role)
    );

    if (!hasRequiredRole) {
      throw new ForbiddenException('このアクションを実行する権限がありません');
    }

    return true;
  }

  /**
   * ユーザーのロールを取得します
   * @param userId ユーザーID
   * @returns ユーザーのロール名の配列
   */
  private async getUserRoles(userId: number): Promise<string[]> {
    if (!userId) {
      return [];
    }

    // Prismaクライアントの型を明示的に定義
    type UserRoleWithIncludedRole = {
      role: {
        name: string;
      };
    };

    type FindManyFunction = (params: {
      where: { userId: number };
      include: { role: boolean };
    }) => Promise<UserRoleWithIncludedRole[]>;

    // 型アサーションを適用（インライン）
    const userRoles =
      await // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (this.prisma.userRole.findMany as unknown as FindManyFunction)({
        where: { userId },
        include: { role: true },
      });

    return userRoles.map((ur) => ur.role.name);
  }
}
