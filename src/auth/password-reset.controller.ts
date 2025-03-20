import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { PasswordResetService } from './password-reset.service';
import { Public } from './decorators/public.decorator';

// パスワードリセット要求のためのDTO
class RequestResetDto {
  email: string;
}

// トークン検証用のDTO
class ValidateTokenDto {
  token: string;
}

// パスワードリセット実行用のDTO
class ResetPasswordDto {
  token: string;
  newPassword: string;
}

@Controller('auth/password-reset')
export class PasswordResetController {
  constructor(private readonly passwordResetService: PasswordResetService) {}

  /**
   * パスワードリセットを要求するエンドポイント
   * @param requestResetDto メールアドレスを含むリクエスト
   * @returns 成功メッセージ
   */
  @Public()
  @Post('request')
  async requestReset(
    @Body() requestResetDto: RequestResetDto
  ): Promise<{ message: string }> {
    return this.passwordResetService.generateResetToken(requestResetDto.email);
  }

  /**
   * リセットトークンの有効性を検証するエンドポイント
   * @param validateTokenDto 検証するトークン
   * @returns 検証結果
   */
  @Public()
  @Post('validate-token')
  @HttpCode(HttpStatus.OK)
  async validateToken(
    @Body() validateTokenDto: ValidateTokenDto
  ): Promise<{ valid: boolean }> {
    const isValid = await this.passwordResetService.validateResetToken(
      validateTokenDto.token
    );
    return { valid: isValid };
  }

  /**
   * パスワードをリセットするエンドポイント
   * @param resetPasswordDto トークンと新しいパスワード
   * @returns 成功メッセージ
   */
  @Public()
  @Post('reset')
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto
  ): Promise<{ message: string }> {
    // パスワードの基本的な検証
    if (
      !resetPasswordDto.newPassword ||
      resetPasswordDto.newPassword.length < 8
    ) {
      throw new BadRequestException(
        'パスワードは8文字以上である必要があります'
      );
    }

    return this.passwordResetService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword
    );
  }
}
