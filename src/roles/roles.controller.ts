import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  /**
   * すべてのロールを取得します
   * @param includePermissions 権限情報を含めるかどうか（クエリパラメータ）
   * @returns ロールの配列
   */
  @Get()
  @Roles('admin')
  async findAll(@Query('include_permissions') includePermissions?: string) {
    const includePerm = includePermissions === 'true';
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.rolesService.findAll(includePerm);
  }

  /**
   * すべての権限を取得します
   * @returns 権限の配列
   */
  @Get('permissions')
  @Roles('admin')
  async getAllPermissions() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.rolesService.getAllPermissions();
  }

  /**
   * 指定されたIDのロールを取得します
   * @param id ロールID
   * @returns ロール情報
   */
  @Get(':id')
  @Roles('admin')
  async findById(@Param('id', ParseIntPipe) id: number) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.rolesService.findById(id);
  }

  /**
   * 新しいロールを作成します
   * @param createRoleDto ロール作成データ
   * @returns 作成されたロール
   */
  @Post()
  @Roles('admin')
  async create(@Body() createRoleDto: CreateRoleDto) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.rolesService.create(createRoleDto);
  }

  /**
   * 指定されたロールを更新します
   * @param id ロールID
   * @param updateRoleDto 更新データ
   * @returns 更新されたロール
   */
  @Put(':id')
  @Roles('admin')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRoleDto: UpdateRoleDto
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.rolesService.update(id, updateRoleDto);
  }

  /**
   * 指定されたロールを削除します
   * @param id ロールID
   * @returns 削除されたロール
   */
  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.rolesService.delete(id);
  }

  /**
   * 指定されたユーザーのすべてのロールを取得します
   * @param userId ユーザーID
   * @returns ユーザーのロール配列
   */
  @Get('users/:userId')
  @Roles('admin')
  async getUserRoles(@Param('userId', ParseIntPipe) userId: number) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.rolesService.getUserRoles(userId);
  }

  /**
   * 指定されたユーザーにロールを割り当てます
   * @param userId ユーザーID
   * @param roleId ロールID（リクエストボディ）
   * @returns 作成されたユーザーロール関連
   */
  @Post('users/:userId/assign')
  @Roles('admin')
  async assignRoleToUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: { roleId: number }
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.rolesService.assignRoleToUser(userId, body.roleId);
  }

  /**
   * 指定されたユーザーからロールを削除します
   * @param userId ユーザーID
   * @param roleId ロールID（リクエストボディ）
   * @returns 削除されたユーザーロール関連
   */
  @Delete('users/:userId/roles/:roleId')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeRoleFromUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('roleId', ParseIntPipe) roleId: number
  ) {
    await this.rolesService.removeRoleFromUser(userId, roleId);
  }

  /**
   * ユーザーが特定のロールを持っているか確認します
   * @param userId ユーザーID
   * @param roleName ロール名（クエリパラメータ）
   * @returns ロールを持っている場合はtrue
   */
  @Get('users/:userId/has-role')
  @Roles('admin')
  async userHasRole(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('role') roleName: string
  ) {
    if (!roleName) {
      return { error: 'ロール名が指定されていません' };
    }
    const hasRole = await this.rolesService.userHasRole(userId, roleName);
    return { hasRole };
  }

  /**
   * ユーザーが特定の権限を持っているか確認します
   * @param userId ユーザーID
   * @param permissionName 権限名（クエリパラメータ）
   * @returns 権限を持っている場合はtrue
   */
  @Get('users/:userId/has-permission')
  @Roles('admin')
  async userHasPermission(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('permission') permissionName: string
  ) {
    if (!permissionName) {
      return { error: '権限名が指定されていません' };
    }
    const hasPermission = await this.rolesService.userHasPermission(
      userId,
      permissionName
    );
    return { hasPermission };
  }
}
