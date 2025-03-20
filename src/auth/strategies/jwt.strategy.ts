import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService
    // ここで必要に応じてUserServiceを注入することもできます
    // private userService: UserService,
  ) {
    const jwtSecret = configService.get<string>('jwt.accessSecret');

    // JWT シークレットが設定されていない場合、明示的にエラーを発生させる
    if (!jwtSecret) {
      throw new Error(
        'JWT アクセストークンのシークレットキーが環境変数に設定されていません'
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  /**
   * JWTペイロードを検証して、認証されたユーザーを返します
   * このメソッドは、PassportによってJWTが正常に検証された後に呼び出されます
   *
   * @param payload 検証済みのJWTペイロード
   * @returns 認証されたユーザー情報（リクエストのuser属性に設定されます）
   */
  async validate(payload: JwtPayload): Promise<any> {
    // JWTのペイロードから必要な情報を取得
    const { sub: userId } = payload;

    // ここでユーザーの存在確認や追加の検証を行うことができます
    // 例: const user = await this.userService.findById(userId);
    // if (!user) { throw new UnauthorizedException('ユーザーが見つかりません'); }

    // 将来的にはここでユーザーデータベースとの連携など実際の非同期処理を行う
    // 現段階では単純に非同期処理をシミュレートして ESLint エラーを解消
    await Promise.resolve();

    // 検証が成功した場合、このオブジェクトはrequset.userとして設定されます
    return {
      userId,
      ...payload,
    };
  }
}
