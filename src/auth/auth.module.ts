import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { GitHubStrategy } from './strategies/github.strategy';
import { AuthController } from './auth.controller';
import { RefreshTokenService } from './refresh-token.service';
import { PasswordResetService } from './password-reset.service';
import { PasswordResetController } from './password-reset.controller';
import { OAuthController } from './oauth.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        // asyncキーワードを削除
        secret: configService.get('jwt.accessSecret'),
        signOptions: {
          expiresIn: configService.get('jwt.accessExpiresIn'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    GitHubStrategy,
    RefreshTokenService,
    PasswordResetService,
  ],
  controllers: [AuthController, PasswordResetController, OAuthController],
  exports: [
    JwtModule,
    AuthService,
    PassportModule,
    RefreshTokenService,
    PasswordResetService,
  ],
})
export class AuthModule {}
