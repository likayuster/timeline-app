import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CsrfService } from './csrf.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [CsrfService],
  exports: [CsrfService],
})
export class SecurityModule {}
