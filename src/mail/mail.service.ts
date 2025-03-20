import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import SMTPConnection from 'nodemailer/lib/smtp-connection';

// 明示的にメール送信オプションの型を定義
interface MailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

// 明示的に送信結果の型を定義
interface MailResult {
  success: boolean;
  messageId?: string;
  previewUrl?: string;
}

@Injectable()
export class MailService implements OnModuleInit {
  private transporter!: nodemailer.Transporter<SMTPTransport.SentMessageInfo>;
  private readonly logger = new Logger(MailService.name);
  private readonly mailFrom: string;

  constructor(private configService: ConfigService) {
    this.mailFrom =
      this.configService.get<string>('mail.from') ||
      '"アプリケーション" <noreply@example.com>';

    // 非同期初期化のためにコンストラクタでは最小限の処理だけ行う
  }

  // NestJSのライフサイクルフックを使用して非同期初期化を実行
  async onModuleInit(): Promise<void> {
    if (this.configService.get('NODE_ENV') === 'production') {
      await this.initProductionTransporter();
    } else {
      await this.initDevelopmentTransporter();
    }
    this.logger.log(
      `メールサービスを初期化しました。環境: ${this.configService.get('NODE_ENV')}`
    );
  }

  // 本番環境用トランスポータ初期化
  private async initProductionTransporter(): Promise<void> {
    const mailHost = this.configService.get<string>('mail.host');
    const mailPort = this.configService.get<number>('mail.port');
    const mailUser = this.configService.get<string>('mail.user');
    const mailPassword = this.configService.get<string>('mail.password');

    // 明示的に型を指定したトランスポート設定
    const transportOptions: SMTPTransport.Options = {
      host: mailHost,
      port: mailPort,
      secure: mailPort === 465,
      auth: {
        user: mailUser ?? '',
        pass: mailPassword ?? '',
      },
    };

    this.transporter = nodemailer.createTransport(transportOptions);

    // 接続テスト
    try {
      await this.transporter.verify();
      this.logger.log('SMTPサーバーへの接続に成功しました');
    } catch (error) {
      this.logger.error('SMTPサーバーへの接続に失敗しました', error);
      // エラーを再スローする代わりにフォールバックメカニズムを実装することも可能
    }
  }

  // 開発環境用トランスポータ初期化
  private async initDevelopmentTransporter(): Promise<void> {
    try {
      // テスト用アカウントを生成
      const testAccount = await nodemailer.createTestAccount();

      // 明示的に型を指定したトランスポート設定
      const transportOptions: SMTPTransport.Options = {
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      };

      this.transporter = nodemailer.createTransport(transportOptions);

      this.logger.log(
        `開発用メールアカウントを生成しました: ${testAccount.user}`
      );
      this.logger.log(
        'メールの確認は https://ethereal.email にアクセスしてください'
      );
    } catch (error) {
      this.logger.error(
        '開発用メールアカウントの生成に失敗しました',
        error instanceof Error ? error.message : String(error)
      );

      // コンソール出力用のモックトランスポーター
      this.createMockTransporter();
    }
  }

  // モックトランスポーターの作成（型安全に実装）
  private createMockTransporter(): void {
    // 正しい型を使用して認証オブジェクトを作成
    const auth: SMTPConnection.AuthenticationType = {
      type: 'login',
      user: '',
      pass: '',
    };

    const mockTransportOptions: SMTPTransport.Options = {
      host: 'localhost',
      port: 25,
      secure: false,
      auth: auth, // 型安全な認証オブジェクト
    };

    // 基本的なトランスポータを作成
    this.transporter = nodemailer.createTransport(mockTransportOptions);

    // 送信メソッドをオーバーライド
    this.transporter.sendMail = (
      mailOptions: nodemailer.SendMailOptions
    ): Promise<SMTPTransport.SentMessageInfo> => {
      this.logger.debug(
        'モックメール送信:',
        JSON.stringify(mailOptions, null, 2)
      );

      // 型安全なモックレスポンスを返す
      const mockInfo: SMTPTransport.SentMessageInfo = {
        accepted: [mailOptions.to].flat().filter(Boolean).map(String),
        rejected: [],
        pending: [],
        response: 'Mock response',
        envelope: {
          from:
            typeof mailOptions.from === 'string'
              ? mailOptions.from
              : typeof mailOptions.from === 'object' &&
                  mailOptions.from !== null &&
                  'address' in mailOptions.from
                ? mailOptions.from.address
                : this.mailFrom,
          to: Array.isArray(mailOptions.to)
            ? mailOptions.to.map((t) => this.getSafeEmailAddress(t))
            : [this.getSafeEmailAddress(mailOptions.to || '')],
        },
        messageId: `mock-id-${Date.now()}@localhost`,
      };

      return Promise.resolve(mockInfo);
    };
  }

  // メールアドレスを安全に取得するヘルパーメソッド
  private getSafeEmailAddress(
    address: string | { name?: string; address: string } | undefined
  ): string {
    if (!address) return '';

    if (typeof address === 'string') return address;

    if ('address' in address) return address.address;

    return '';
  }

  /**
   * メールを送信します
   */
  async sendMail(options: MailOptions): Promise<MailResult> {
    try {
      // 型安全なメールオプション
      const mailOptions: nodemailer.SendMailOptions = {
        from: this.mailFrom,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      };

      // 型安全な送信処理
      const info = await this.transporter.sendMail(mailOptions);

      let previewUrl: string | null = null;

      // 開発環境の場合、プレビューURLを提供
      if (
        this.configService.get('NODE_ENV') !== 'production' &&
        'getTestMessageUrl' in nodemailer
      ) {
        const urlOrUndefined = nodemailer.getTestMessageUrl(info);
        if (urlOrUndefined) {
          previewUrl = urlOrUndefined.toString();
          this.logger.debug(`メールプレビューURL: ${previewUrl}`);
        }
      }

      this.logger.log(`メールを送信しました: ${info.messageId}`);

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: previewUrl ?? undefined,
      };
    } catch (error) {
      this.logger.error(
        `メール送信に失敗しました: ${error instanceof Error ? error.message : String(error)}`
      );
      return { success: false };
    }
  }

  /**
   * パスワードリセットメールを送信します
   */
  async sendPasswordResetEmail(
    to: string,
    resetToken: string,
    username: string
  ): Promise<MailResult> {
    // アプリケーションのベースURL（フロントエンド）
    const appUrl =
      this.configService.get<string>('app.url') || 'http://localhost:3000';

    // リセットリンクを生成
    const resetLink = `${appUrl}/reset-password?token=${resetToken}`;

    // メールの件名
    const subject = 'パスワードリセットのご案内';

    // プレーンテキスト版
    const text = `
こんにちは ${username} さん、

パスワードリセットのリクエストを受け付けました。

下記のリンクをクリックして、新しいパスワードを設定してください：
${resetLink}

このリンクは1時間のみ有効です。

リクエストした覚えがない場合は、このメールを無視してください。
あなたのアカウントは安全です。

--
アプリケーションチーム
`;

    // HTML版
    const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>パスワードリセット</h2>
  <p>こんにちは ${username} さん、</p>
  <p>パスワードリセットのリクエストを受け付けました。</p>
  <p>下記のボタンをクリックして、新しいパスワードを設定してください：</p>
  <p style="text-align: center; margin: 30px 0;">
    <a href="${resetLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">
      パスワードをリセット
    </a>
  </p>
  <p>このリンクは<strong>1時間のみ</strong>有効です。</p>
  <p>リクエストした覚えがない場合は、このメールを無視してください。あなたのアカウントは安全です。</p>
  <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
  <p style="color: #777; font-size: 12px;">
    &copy; ${new Date().getFullYear()} アプリケーションチーム
  </p>
</div>
`;

    // メールを送信
    return this.sendMail({
      to,
      subject,
      text,
      html,
    });
  }
}
