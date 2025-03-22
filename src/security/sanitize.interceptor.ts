import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SanitizeService } from './sanitize.service';
import { Request } from 'express';

// Expressリクエストを拡張して、bodyを変更可能にする
interface ExtendedRequest extends Request {
  body: Record<string, unknown>;
}

// レスポンスデータの型を定義
interface ResponseData {
  isHtmlContent?: boolean;
  [key: string]: unknown;
}

@Injectable()
export class SanitizeInterceptor implements NestInterceptor {
  constructor(private readonly sanitizeService: SanitizeService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // リクエストのボディをサニタイズ
    const request = context.switchToHttp().getRequest<ExtendedRequest>();
    if (request.body) {
      // 型安全なサニタイズ処理
      const sanitizedBody = this.sanitizeService.sanitizeObject(request.body);
      request.body = sanitizedBody;
    }

    // レスポンスデータのサニタイズ（機密データや内部エラーの漏洩を防止）
    return next.handle().pipe(
      map((data) => {
        // レスポンスがオブジェクトの場合の処理
        if (data && typeof data === 'object') {
          // ResponseData型にキャストして安全にプロパティにアクセス
          const responseData = data as ResponseData;

          // 明示的なHTMLコンテンツでない場合のみサニタイズ
          if (!responseData.isHtmlContent) {
            // 型安全なサニタイズ処理 - キャストを分解して明示的に行う
            const sanitizedData =
              this.sanitizeService.sanitizeObject<ResponseData>(responseData);
            // 元のデータと同じ型として返す（型安全性を維持）
            return sanitizedData as unknown as typeof data;
          }
        }
        return data;
      })
    );
  }
}
