import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

// ユーザーオブジェクトの型を定義
export interface UserPayload {
  id: number;
  email: string;
  username: string;
  roles?: string[];
  [key: string]: any; // その他のプロパティ
}

// Express の Request 型を拡張して user プロパティを定義
interface RequestWithUser extends Request {
  user: UserPayload;
}

/**
 * 現在の認証済みユーザーを取得するデコレーター
 * @example
 * @Get('profile')
 * getProfile(@CurrentUser() user: UserPayload) {
 *   return user;
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserPayload => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  }
);
