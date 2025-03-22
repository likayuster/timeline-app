import { Module, Global } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-store';
import { RedisService } from './redis.service';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const store = await redisStore({
          socket: {
            host: configService.get<string>('redis.host', 'localhost'),
            port: configService.get<number>('redis.port', 6379),
          },
          password: configService.get<string>('redis.password', ''),
          database: configService.get<number>('redis.db', 0),
          ttl: 60 * 60, // デフォルト有効期限: 1時間
          // Redis接続オプション
          retryStrategy: (times: number) => {
            // 開発環境では Redis が利用できなくてもエラーにしない
            if (configService.get('nodeEnv') === 'development') {
              console.warn(`Redis接続を試行中... (${times}回目)`);
              return Math.min(times * 100, 3000); // 最大3秒間隔でリトライ
            }
            // 本番環境では15回まで再試行
            if (times > 15) {
              throw new Error('Redis接続に失敗しました');
            }
            return Math.min(times * 100, 3000);
          },
        });

        return {
          store: store as any, // 型の互換性のため
          ttl: 60 * 60, // デフォルト有効期限: 1時間
        };
      },
    }),
  ],
  providers: [RedisService],
  exports: [CacheModule, RedisService],
})
export class RedisModule {}
