/* eslint-disable @typescript-eslint/no-unsafe-assignment */ /* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Tokens from 'csrf';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class CsrfService {
  private readonly tokens: Tokens;
  private readonly secret: string; // 単一のシークレットを保持
  private readonly csrfCookieName: string;
  private readonly headerName: string;
  private readonly cookieOptions: Record<string, any>;
  private readonly logger = new Logger(CsrfService.name);

  constructor(private readonly configService: ConfigService) {
    // CSRFトークン生成ライブラリの初期化
    this.tokens = new Tokens();

    // アプリケーション全体で使用する単一のシークレットを生成
    this.secret = this.tokens.secretSync();
    this.logger.log('CSRF保護のためのシークレットが生成されました');

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
      maxAge: 86400, // 24時間に延長（開発時の利便性向上）
    };
  }

  /**
   * CSRFトークンを生成
   * 一貫したシークレット（this.secret）を使用
   * @returns 生成されたトークン
   */
  generateToken(): string {
    return this.tokens.create(this.secret);
  }

  /**
   * CSRFトークンを検証
   * 生成時と同じシークレットを使用
   * @param token 検証するトークン
   * @returns 検証結果（有効な場合はtrue）
   */
  verifyToken(token: string): boolean {
    try {
      return this.tokens.verify(this.secret, token);
    } catch (error) {
      this.logger.error(`トークン検証エラー: ${error.message}`);
      return false;
    }
  }

  /**
   * レスポンスにCSRFトークンを設定
   * @param res Expressのレスポンスオブジェクト
   * @param token 設定するトークン
   */
  setTokenCookie(res: Response, token: string): void {
    res.cookie(this.csrfCookieName, token, this.cookieOptions);
    this.logger.debug(`CSRFトークンをクッキーに設定: ${this.csrfCookieName}`);
  }

  /**
   * CSRFトークンを取得するためのミドルウェア
   * トークンを生成してクッキーに設定し、JSONレスポンスとして返す
   */
  getCsrfTokenMiddleware() {
    return (req: Request, res: Response): void => {
      const token = this.generateToken();
      this.setTokenCookie(res, token);

      // デバッグ用にヘッダー情報をログに出力
      this.logger.debug('CSRFトークンリクエスト', {
        endpoint: req.originalUrl,
        method: req.method,
        token,
      });

      // JSONレスポンスを返す
      res.json({
        message: 'CSRFトークンが設定されました',
        // 開発環境ではトークン値も返す（デバッグ用）
        token:
          this.configService.get<string>('nodeEnv') !== 'production'
            ? token
            : undefined,
      });
    };
  }

  /**
   * CSRFトークンを保護するミドルウェア
   * リクエストに含まれるトークンを検証する
   */
  protectCsrfMiddleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      // GET、HEAD、OPTIONSリクエストは検証をスキップ（安全なメソッド）
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
      }

      // 開発モードではデバッグ情報を出力
      if (this.configService.get<string>('nodeEnv') !== 'production') {
        this.logger.debug('CSRF検証情報', {
          method: req.method,
          headers: req.headers[this.headerName.toLowerCase()],
          cookies: req.cookies[this.csrfCookieName],
          hasCsrfInBody: req.body && '_csrf' in req.body,
        });
      }

      // リクエストからトークンを取得（ヘッダーまたはボディから）
      const token =
        (req.headers[this.headerName.toLowerCase()] as string) ||
        (req.body && (req.body._csrf as string));

      // トークンが存在しない場合
      if (!token) {
        this.logger.warn('CSRFトークンが見つかりません', {
          url: req.originalUrl,
          method: req.method,
        });

        res.status(403).json({
          error: 'CSRF検証エラー: トークンが見つかりません',
        });
      }

      // トークンの検証（改善されたロジック）
      if (!this.verifyToken(token as string)) {
        this.logger.warn('無効なCSRFトークン', {
          url: req.originalUrl,
          method: req.method,
          token,
        });

        res.status(403).json({
          error: 'CSRF検証エラー: 無効なトークン',
        });
      }

      // 検証成功
      this.logger.debug('CSRF検証成功', {
        url: req.originalUrl,
        method: req.method,
      });
      next();
    };
  }

  /**
   * トークンをクッキー名とヘッダー名と共に返す
   * フロントエンドがトークンの取得と設定方法を知るための情報
   */
  getCsrfTokenInfo(): { cookieName: string; headerName: string } {
    return {
      cookieName: this.csrfCookieName,
      headerName: this.headerName,
    };
  }
}
