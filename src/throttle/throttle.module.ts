/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Module, Global } from '@nestjs/common';
import { ThrottlerModule, ThrottlerStorage } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerStorageRedisService } from './throttler-storage-redis.service';

@Global()
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisHost = configService.get<string>('redis.host');

        // 明示的な型アノテーションを追加
        const storage: ThrottlerStorage | undefined = redisHost
          ? // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            new ThrottlerStorageRedisService(configService)
          : undefined;

        return {
          throttlers: [
            {
              ttl: configService.get<number>('throttle.ttl', 60),
              limit: configService.get<number>('throttle.limit', 100),
            },
          ],
          storage,
        };
      },
    }),
  ],
  providers: [ThrottlerStorageRedisService],
  exports: [ThrottlerModule],
})
export class ThrottleModule {}
