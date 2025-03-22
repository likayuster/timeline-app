import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

// Redisストアの型を定義（クラスの外部に移動）
interface RedisStore {
  getClient?: () => {
    keys: (pattern: string) => Promise<string[]>;
    del: (keys: string[]) => Promise<void>;
  };
}

@Injectable()
export class RedisService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * キャッシュからデータを取得
   * @param key キャッシュキー
   * @returns キャッシュされた値、または undefined
   */
  async get<T>(key: string): Promise<T | undefined> {
    const value = await this.cacheManager.get<T>(key);
    return value === null ? undefined : value;
  }

  /**
   * データをキャッシュに保存
   * @param key キャッシュキー
   * @param value 保存する値
   * @param ttl 有効期限（秒）、指定しない場合はデフォルト値
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    await this.cacheManager.set(key, value, ttl);
  }

  /**
   * キャッシュからデータを削除
   * @param key キャッシュキー
   */
  async del(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  async delByPattern(pattern: string): Promise<void> {
    try {
      // 適切な型を使用
      const store = this.cacheManager.stores as unknown as RedisStore;
      if (store.getClient) {
        const client = store.getClient();
        const keys = await client.keys(pattern);
        if (keys.length > 0) {
          await client.del(keys);
        }
      }
    } catch (error) {
      console.error('キャッシュ削除エラー:', error);
    }
  }

  /**
   * キャッシュを完全にクリア
   */
  async reset(): Promise<void> {
    await this.cacheManager.clear();
  }

  /**
   * キャッシュに値が存在するかチェック
   * @param key キャッシュキー
   * @returns 存在する場合は true
   */
  async has(key: string): Promise<boolean> {
    const value = await this.cacheManager.get(key);
    return value !== undefined;
  }

  /**
   * 処理結果をキャッシュするヘルパーメソッド
   * キャッシュに値がある場合はそれを返し、なければ関数を実行して結果をキャッシュ
   * @param key キャッシュキー
   * @param fn 実行する関数
   * @param ttl 有効期限（秒）
   */
  async getOrSet<T>(
    key: string,
    fn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const result = await fn();
    await this.set(key, result, ttl);
    return result;
  }
}
