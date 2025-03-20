export default () => ({
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  database: {
    url: process.env.DATABASE_URL,
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
  },
  auth: {
    passwordResetExpiresInHours: process.env.PASSWORD_RESET_EXPIRES_IN_HOURS
      ? parseInt(process.env.PASSWORD_RESET_EXPIRES_IN_HOURS, 10)
      : 1,
  },
  nodeEnv: process.env.NODE_ENV || 'development',
});
