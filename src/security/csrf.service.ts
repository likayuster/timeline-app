import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as csrf from 'csrf';

@Injectable()
export class CsrfService {
  private readonly tokens: any;
  private readonly csrfCookieName: string;
  private readonly headerName: string;
  private readonly cookieOptions: any;

  constructor(private readonly configService: ConfigService) {
    // CSRFトークン生成ライブラリの初期化
    this.tokens = new csrf();

    // 設定値の読み込み（デフォルト値を設定）
    this.csrfCookieName = this.configService.get<string>(
      'security.csrf.cookieName',
      'XSRF-TOKEN'
    );
    this.headerName = this.configService.get<string>(
      'security.csrf.headerName',
      'X-XSRF-TOKEN'
    );

    // クッキーオプションの設定
    const isProduction =
      this.configService.get<string>('nodeEnv') === 'production';
    this.cookieOptions = {
      httpOnly: false, // JavaScriptからアクセス可能に（フロントエンドで使用するため）
      sameSite: isProduction ? 'strict' : 'lax', // 本番環境では厳格に
      secure: isProduction, // 本番環境ではhttpsのみ
      path: '/',
      maxAge: 3600, // 1時間
    };
  }

  /**
   * 新しいCSRFトークンを生成
   * @returns 生成されたトークン
   */
  generateToken(): string {
    // シークレットの生成
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const secret = this.tokens.secretSync();
    // シークレットからトークンを作成
    return this.tokens.create(secret);
  }

  /**
   * CSRFトークンを検証
   * @param token 検証するトークン
   * @param secret トークン生成に使用されたシークレット
   * @returns 検証結果（有効な場合はtrue）
   */
  verifyToken(token: string, secret: string): boolean {
    return this.tokens.verify(secret, token);
  }

  /**
   * レスポンスにCSRFトークンを設定
   * @param res Expressのレスポンスオブジェクト
   * @param token 設定するトークン
   */
  setTokenCookie(res: any, token: string): void {
    res.cookie(this.csrfCookieName, token, this.cookieOptions);
  }

  /**
   * CSRFトークンを取得するためのミドルウェア
   * 新しいトークンを生成してクッキーに設定
   */
  getCsrfTokenMiddleware() {
    return (req, res, next) => {
      const token = this.generateToken();
      this.setTokenCookie(res, token);
      next();
    };
  }

  /**
   * CSRFトークンを保護するミドルウェア
   * リクエストに含まれるトークンを検証
   */
  protectCsrfMiddleware() {
    return (req, res, next) => {
      // GET、HEAD、OPTIONSリクエストは検証をスキップ（安全なメソッド）
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
      }

      // リクエストからトークンを取得（ヘッダーまたはボディから）
      const token =
        req.headers[this.headerName.toLowerCase()] ||
        (req.body && req.body._csrf);

      // クッキーからシークレットを取得
      const secret = req.cookies[this.csrfCookieName];

      // トークンまたはシークレットが存在しない場合
      if (!token || !secret) {
        return res.status(403).json({
          error: 'CSRF検証エラー: トークンが見つかりません',
        });
      }

      // トークンの検証
      if (!this.verifyToken(token, secret)) {
        return res.status(403).json({
          error: 'CSRF検証エラー: 無効なトークン',
        });
      }

      next();
    };
  }

  /**
   * トークンをクッキー名とヘッダー名と共に返す
   * フロントエンドがトークンの取得と設定方法を知るための情報
   */
  getCsrfTokenInfo() {
    return {
      cookieName: this.csrfCookieName,
      headerName: this.headerName,
    };
  }
}
