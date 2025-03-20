import * as bcrypt from 'bcrypt';

/**
 * ユーザーパスワードをハッシュ化します
 * @param password ユーザーの平文パスワード
 * @returns ハッシュ化されたパスワード
 */
export async function hashPassword(password: string): Promise<string> {
  // ソルトラウンド数（コストファクター）- 値が大きいほど安全だが処理時間も長くなる
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

/**
 * 入力されたパスワードと保存されているハッシュを比較し、一致するか検証します
 * @param plainPassword ユーザーが入力した平文パスワード
 * @param hashedPassword データベースに保存されているハッシュ化パスワード
 * @returns 一致する場合はtrue、それ以外はfalse
 */
export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}
