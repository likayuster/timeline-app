import * as Joi from 'joi';

// バリデーションスキーマの定義
export const validationSchema = Joi.object({
  // アプリケーション設定
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  // データベース設定
  DATABASE_URL: Joi.string().required(),

  // Redis設定
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),

  // JWT設定
  JWT_ACCESS_SECRET: Joi.string().required(),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_ACCESS_EXPIRATION: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),

  // レート制限設定
  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(100),
});

export default () => ({
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    url: process.env.DATABASE_URL,
  },

  // Redis 設定（新規追加）
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : 0,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRATION || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d',
  },
  mail: {
    host: process.env.MAIL_HOST || 'smtp.example.com',
    port: process.env.MAIL_PORT ? parseInt(process.env.MAIL_PORT, 10) : 587,
    user: process.env.MAIL_USER || 'user@example.com',
    password: process.env.MAIL_PASSWORD || 'password',
    from: process.env.MAIL_FROM || '"アプリケーション" <noreply@example.com>',
  },
  app: {
    url: process.env.APP_URL || 'http://localhost:3000',
    corsOrigins: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',')
      : ['http://localhost:3000'],
  },
  auth: {
    passwordResetExpiresInHours: process.env.PASSWORD_RESET_EXPIRES_IN_HOURS
      ? parseInt(process.env.PASSWORD_RESET_EXPIRES_IN_HOURS, 10)
      : 1,
    oauth: {
      // Google OAuth設定
      google: {
        clientID: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        callbackURL:
          process.env.GOOGLE_CALLBACK_URL ||
          'http://localhost:3000/auth/google/callback',
        scope: ['email', 'profile'],
      },
      // GitHub OAuth設定
      github: {
        clientID: process.env.GITHUB_CLIENT_ID || '',
        clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
        callbackURL:
          process.env.GITHUB_CALLBACK_URL ||
          'http://localhost:3000/auth/github/callback',
        scope: ['user:email'],
      },
      // フロントエンドリダイレクト設定（認証成功後のリダイレクト先）
      successRedirect:
        process.env.OAUTH_SUCCESS_REDIRECT ||
        'http://localhost:3000/auth/success',
      // 認証失敗時のリダイレクト先
      failureRedirect:
        process.env.OAUTH_FAILURE_REDIRECT ||
        'http://localhost:3000/auth/login',
    },
  },
  // API レート制限設定（新規追加）
  throttle: {
    ttl: process.env.THROTTLE_TTL ? parseInt(process.env.THROTTLE_TTL, 10) : 60,
    limit: process.env.THROTTLE_LIMIT
      ? parseInt(process.env.THROTTLE_LIMIT, 10)
      : 100,
    // エンドポイント別設定（オプション）
    auth: {
      ttl: process.env.THROTTLE_AUTH_TTL
        ? parseInt(process.env.THROTTLE_AUTH_TTL, 10)
        : 60,
      limit: process.env.THROTTLE_AUTH_LIMIT
        ? parseInt(process.env.THROTTLE_AUTH_LIMIT, 10)
        : 20,
    },
    posts: {
      ttl: process.env.THROTTLE_POSTS_TTL
        ? parseInt(process.env.THROTTLE_POSTS_TTL, 10)
        : 60,
      limit: process.env.THROTTLE_POSTS_LIMIT
        ? parseInt(process.env.THROTTLE_POSTS_LIMIT, 10)
        : 50,
    },
  },
  security: {
    csrf: {
      cookieName: process.env.CSRF_COOKIE_NAME || 'XSRF-TOKEN',
      headerName: process.env.CSRF_HEADER_NAME || 'X-XSRF-TOKEN',
      enabled: process.env.CSRF_ENABLED !== 'false', // デフォルトで有効
    },
  },
});
