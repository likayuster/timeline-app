import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sanitizeHtml from 'sanitize-html';

@Injectable()
export class SanitizeService {
  // デフォルトのサニタイズオプション
  private readonly defaultOptions: sanitizeHtml.IOptions;

  // 投稿コンテンツ用のサニタイズオプション（より柔軟）
  private readonly postContentOptions: sanitizeHtml.IOptions;

  // ユーザープロフィール用のサニタイズオプション（中程度の制限）
  private readonly profileOptions: sanitizeHtml.IOptions;

  constructor(private readonly configService: ConfigService) {
    // デフォルトのサニタイズオプション - 最も厳格
    this.defaultOptions = {
      allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
      allowedAttributes: {
        a: ['href', 'target', 'rel'],
      },
      allowedSchemes: ['http', 'https', 'mailto'],
      transformTags: {
        // すべての外部リンクに rel="noopener noreferrer" を追加
        a: (tagName, attribs) => {
          if (attribs.href && attribs.href.startsWith('http')) {
            return {
              tagName,
              attribs: {
                ...attribs,
                target: '_blank',
                rel: 'noopener noreferrer',
              },
            };
          }
          return { tagName, attribs };
        },
      },
      // iframeやスクリプトなどの危険なタグをすべて削除
      disallowedTagsMode: 'discard',
    };

    // 投稿コンテンツ用のサニタイズオプション - より多くのタグを許可
    this.postContentOptions = {
      ...this.defaultOptions,
      allowedTags: [
        ...(this.defaultOptions.allowedTags as string[]),
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'blockquote',
        'pre',
        'code',
        'ul',
        'ol',
        'li',
        'dl',
        'dt',
        'dd',
        'img',
        'hr',
      ],
      allowedAttributes: {
        ...this.defaultOptions.allowedAttributes,
        img: ['src', 'alt', 'title', 'width', 'height'],
        code: ['class'],
      },
    };

    // ユーザープロフィール用のサニタイズオプション
    this.profileOptions = {
      ...this.defaultOptions,
      // プロフィールでは画像を許可
      allowedTags: [...(this.defaultOptions.allowedTags as string[]), 'img'],
      allowedAttributes: {
        ...this.defaultOptions.allowedAttributes,
        img: ['src', 'alt', 'width', 'height'],
      },
    };
  }

  /**
   * HTMLコンテンツをサニタイズ（デフォルトオプション使用）
   * @param html サニタイズするHTML文字列
   * @returns サニタイズされたHTML文字列
   */
  sanitize(html: string): string {
    if (!html) return '';
    return sanitizeHtml(html, this.defaultOptions);
  }

  /**
   * 投稿コンテンツをサニタイズ
   * @param html サニタイズするHTML文字列
   * @returns サニタイズされたHTML文字列
   */
  sanitizePostContent(html: string): string {
    if (!html) return '';
    return sanitizeHtml(html, this.postContentOptions);
  }

  /**
   * ユーザープロフィールをサニタイズ
   * @param html サニタイズするHTML文字列
   * @returns サニタイズされたHTML文字列
   */
  sanitizeProfile(html: string): string {
    if (!html) return '';
    return sanitizeHtml(html, this.profileOptions);
  }

  /**
   * プレーンテキストとして扱うべき文字列をサニタイズ
   * HTMLタグをすべて削除
   * @param text サニタイズするテキスト
   * @returns サニタイズされたプレーンテキスト
   */
  sanitizePlainText(text: string): string {
    if (!text) return '';
    return sanitizeHtml(text, { allowedTags: [] });
  }

  /**
   * オブジェクト内のすべての文字列プロパティをサニタイズ
   * @param obj サニタイズするオブジェクト
   * @returns サニタイズされたオブジェクト
   */
  sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
    if (!obj || typeof obj !== 'object') return obj;

    const sanitized = { ...obj };

    for (const key in sanitized) {
      if (Object.prototype.hasOwnProperty.call(sanitized, key)) {
        const value = sanitized[key];

        if (typeof value === 'string') {
          // 安全な型キャストを使用して代入
          sanitized[key] = this.sanitizePlainText(
            value
          ) as unknown as T[typeof key];
        } else if (typeof value === 'object' && value !== null) {
          // オブジェクト型の場合は再帰的に処理
          sanitized[key] = this.sanitizeObject(
            value as Record<string, unknown>
          ) as unknown as T[typeof key];
        }
      }
    }

    return sanitized;
  }
}
