import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

// 設定サービスのシングルトンインスタンス（設定が利用可能になるまでnull）
let configService: ConfigService | null = null;

/**
 * ConfigServiceをセットするヘルパー関数
 * モジュール初期化時に呼び出す
 */
export function setConfigService(service: ConfigService): void {
  configService = service;
}

/**
 * bcryptのソルトラウンド数を環境設定から取得
 * デフォルト値は10
 */
function getSaltRounds(): number {
  // configServiceが設定されていない場合はデフォルト値を使用
  if (!configService) {
    return 10;
  }

  return configService.get<number>('auth.passwordSaltRounds', 10);
}

/**
 * パスワードをハッシュ化する関数
 *
 * @param password ハッシュ化する平文パスワード
 * @returns ハッシュ化されたパスワード
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = getSaltRounds();
  return bcrypt.hash(password, saltRounds);
}

/**
 * ハッシュ化されたパスワードと平文パスワードを比較する関数
 *
 * @param plainPassword 検証する平文パスワード
 * @param hashedPassword データベースに保存されているハッシュ化パスワード
 * @returns 一致する場合はtrue、それ以外はfalse
 */
export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * テスト用の同期的なパスワードハッシュ化関数
 * 注: 本番環境では使用しないでください
 */
export function hashPasswordSync(password: string): string {
  const saltRounds = getSaltRounds();
  return bcrypt.hashSync(password, saltRounds);
}
