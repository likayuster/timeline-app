import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CsrfService } from './csrf.service';
import { SanitizeService } from './sanitize.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [CsrfService, SanitizeService],
  exports: [CsrfService, SanitizeService],
})
export class SecurityModule {}
