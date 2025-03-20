import { SetMetadata } from '@nestjs/common';

/**
 * このデコレーターが適用されたルートは認証をスキップします
 */
export const Public = () => SetMetadata('isPublic', true);
