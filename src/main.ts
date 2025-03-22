import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as cors from 'cors';
import * as cookieParser from 'cookie-parser';
import { CsrfService } from './security/csrf.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('nodeEnv', 'development');
  const port = configService.get<number>('port', 3000);

  // バリデーションパイプをグローバルに設定
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTOで定義されていないプロパティを除去
      transform: true, // 受信したデータを適切な型に自動変換
      forbidNonWhitelisted: true, // DTOで定義されていないプロパティがあるとエラー
      transformOptions: {
        enableImplicitConversion: true, // 暗黙的な型変換を有効化
      },
    })
  );

  // Helmet.js セットアップ - HTTPヘッダーセキュリティの強化
  app.use(
    helmet({
      // コンテンツセキュリティポリシー設定
      contentSecurityPolicy:
        nodeEnv === 'production'
          ? undefined // 本番環境では厳格なデフォルト設定を使用
          : false, // 開発環境では無効化（開発の容易さのため）

      // X-XSS-Protection ヘッダー設定
      xssFilter: true,

      // HTTP Strict Transport Security 設定
      hsts: {
        maxAge: 15552000, // 180日間
        includeSubDomains: true,
      },

      // X-Frame-Options ヘッダー設定（クリックジャッキング対策）
      frameguard: {
        action: 'deny', // フレーム内での表示を完全に拒否
      },
    })
  );

  // CORS 設定
  const corsOptions: cors.CorsOptions = {
    origin:
      nodeEnv === 'production'
        ? configService.get<string | string[]>('app.corsOrigins', '*') // 本番環境: 明示的に許可されたオリジンのみ
        : '*', // 開発環境: すべてのオリジンを許可
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true, // Cookieを含むリクエストを許可（ログイン機能で重要）
    maxAge: 86400, // プリフライトリクエストのキャッシュ時間（24時間）
  };

  app.enableCors(corsOptions);

  // cookie-parserミドルウェアを追加（CSRFトークンのクッキー処理に必要）
  app.use(cookieParser());

  // CSRF保護の設定
  const csrfEnabled = configService.get<boolean>('security.csrf.enabled', true);
  if (csrfEnabled) {
    const csrfService = app.get(CsrfService);

    // CSRFトークン取得エンドポイント
    app.use('/api/csrf-token', csrfService.getCsrfTokenMiddleware());

    // 安全でないHTTPメソッド（POST, PUT, DELETE）に対してCSRF保護を適用
    app.use(csrfService.protectCsrfMiddleware());
  }

  // アプリケーション起動
  await app.listen(port);
  console.log(`Application running on port ${port} in ${nodeEnv} mode`);
}

bootstrap().catch((error) => console.error('Bootstrap error:', error));
