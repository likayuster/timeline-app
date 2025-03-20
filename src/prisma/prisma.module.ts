import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // このモジュールをグローバルとして登録（全てのモジュールで利用可能に）
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // 他のモジュールから利用できるようにエクスポート
})
export class PrismaModule {}
