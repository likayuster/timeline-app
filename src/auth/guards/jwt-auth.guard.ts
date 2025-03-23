import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  /**
   * リクエストが認証されているかどうかを確認します
   * @param context 実行コンテキスト
   * @returns 認証が成功した場合はtrue、それ以外の場合はfalse
   */
  canActivate(
    context: ExecutionContext
  ): boolean | Promise<boolean> | Observable<boolean> {
    // メタデータから公開ルートかどうかを確認（オプション）
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    // 公開ルートの場合は認証をスキップ
    if (isPublic) {
      return true;
    }

    // 親クラスの認証ロジックを実行
    return super.canActivate(context);
  }

  /**
   * 認証エラー時の処理をカスタマイズします
   * @param err エラーオブジェクト
   * @param user 認証されたユーザー（存在する場合）
   * @param info 認証情報
   */
  handleRequest(err: any, user: any, info: any): any {
    // エラーがある場合、または認証されたユーザーが存在しない場合
    if (err || !user) {
      // 型アサーションを使用して、infoオブジェクトが持つかもしれないプロパティを指定
      const message =
        (info as { message?: string })?.message || '認証に失敗しました';
      throw new UnauthorizedException(message);
    }
    return user;
  }
}
