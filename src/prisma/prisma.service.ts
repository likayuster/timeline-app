import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * テスト環境用のデータベースクリーンアップ
   * 注意: ESLint警告を一部無効化しています - Prismaの動的な性質によるもので、実際の実行時エラーではありません
   */
  async cleanDatabase(): Promise<Prisma.BatchPayload[]> {
    if (process.env.NODE_ENV !== 'production') {
      try {
        // 特定のESLintルールを無効化

        return await this.$transaction([
          this.refreshToken.deleteMany(),
          this.user.deleteMany(),
        ]);
      } catch (error) {
        // テーブルがまだ存在しない場合など、エラーをログに記録
        console.error(
          'データベースクリーンアップ中にエラーが発生しました:',
          error
        );
        return [];
      }
    }
    return [];
  }
}
