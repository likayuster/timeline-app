// src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { MailModule } from './mail/mail.module';
import { RedisModule } from './redis/redis.module';
import { ThrottleModule } from './throttle/throttle.module';
import { SecurityModule } from './security/security.module';
import { SanitizeInterceptor } from './security/sanitize.interceptor';
import { RolesModule } from './roles/roles.module';
import { RolesGuard } from './auth/guards/roles.guard';
import { PrismaService } from './prisma/prisma.service';
import appConfig from './config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    MailModule,
    RedisModule,
    ThrottleModule,
    SecurityModule,
    RolesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SanitizeInterceptor,
    },
    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector, prismaService: PrismaService) => {
        return new RolesGuard(reflector, prismaService);
      },
      inject: [Reflector, PrismaService],
    },
  ],
})
export class AppModule {}
