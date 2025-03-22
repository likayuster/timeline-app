import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { validationSchema } from './config/app.config';

async function bootstrap() {
  // 環境変数のバリデーション
  const validation = validationSchema.validate(process.env, {
    allowUnknown: true, // 未定義の環境変数を許可
    abortEarly: false, // すべてのエラーを一度に表示
  });

  if (validation.error) {
    console.error('環境変数の設定エラー:');
    validation.error.details.forEach((detail) => {
      console.error(`- ${detail.message}`);
    });
    process.exit(1); // 致命的なエラーとして終了
  }

  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((error) => console.error('Bootstrap error:', error));
