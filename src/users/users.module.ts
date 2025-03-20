import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule], // PrismaModuleはグローバルモジュールだが、明示的な依存関係を示すために記載
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // AuthModuleなど他のモジュールからUsersServiceを利用できるようにエクスポート
})
export class UsersModule {}
