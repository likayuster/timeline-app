import { SetMetadata } from '@nestjs/common';

/**
 * エンドポイントへのアクセスに必要なロールを指定するためのメタデータキー
 */
export const ROLES_KEY = 'roles';

/**
 * エンドポイントにアクセスするために必要なロールを指定するデコレータ
 *
 * 使用例:
 * @Roles('admin')
 * @Get('admin-only')
 * adminOnlyEndpoint() {
 *   return { message: '管理者のみアクセス可能' };
 * }
 *
 * または複数のロール:
 * @Roles('admin', 'moderator')
 * @Get('moderation')
 * moderationEndpoint() {
 *   return { message: '管理者またはモデレーターのみアクセス可能' };
 * }
 *
 * @param roles アクセスを許可するロール名の配列
 * @returns メタデータを設定するデコレータ
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
