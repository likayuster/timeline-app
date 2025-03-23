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

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // リクエストのボディをサニタイズ
    const request = context.switchToHttp().getRequest<ExtendedRequest>();
    if (request.body) {
      // 型安全なサニタイズ処理
      const sanitizedBody = this.sanitizeService.sanitizeObject(request.body);
      request.body = sanitizedBody;
    }

    // レスポンスデータのサニタイズ（機密データや内部エラーの漏洩を防止）
    return next.handle().pipe(
      map((data: unknown) => {
        // レスポンスがオブジェクトの場合の処理
        if (data && typeof data === 'object') {
          // ResponseData型に安全にキャスト
          const responseData = data as ResponseData;

          // 明示的なHTMLコンテンツでない場合のみサニタイズ
          if (responseData.isHtmlContent !== true) {
            // 型安全なサニタイズ処理 - 型を明示的に処理
            if (this.isResponseData(data)) {
              // 型ガードを通過した場合のサニタイズ
              return this.sanitizeService.sanitizeObject(responseData);
            }

            // オブジェクトとして安全にサニタイズ
            return this.sanitizeService.sanitizeObject(
              data as Record<string, unknown>
            );
          }
        }
        return data;
      })
    );
  }

  // 型ガード: データがResponseDataインターフェースに準拠しているかをチェック
  private isResponseData(data: unknown): data is ResponseData {
    return (
      typeof data === 'object' &&
      data !== null &&
      ('isHtmlContent' in data || Object.keys(data).length > 0)
    );
  }
}
