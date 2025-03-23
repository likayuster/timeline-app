/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Permission } from '@prisma/client';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  /**
   * すべてのロールを取得します
   * @param includePermissions 権限情報を含めるかどうか
   * @returns ロールの配列
   */
  async findAll(includePermissions = false) {
    const roles = await this.prisma.role.findMany({
      include: {
        permissions: includePermissions
          ? {
              include: {
                permission: true,
              },
            }
          : false,
      },
    });

    return roles; // 中間変数を使うことで型が推論される
  }

  /**
   * 指定されたIDのロールを取得します
   * @param id ロールID
   * @param includePermissions 権限情報を含めるかどうか
   * @returns ロール情報
   */
  async findById(id: number, includePermissions = true) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: includePermissions
          ? {
              include: {
                permission: true,
              },
            }
          : false,
      },
    });

    if (!role) {
      throw new NotFoundException(`ID: ${id} のロールは存在しません`);
    }

    return role;
  }

  /**
   * 指定された名前のロールを取得します
   * @param name ロール名
   * @param includePermissions 権限情報を含めるかどうか
   * @returns ロール情報
   */
  async findByName(name: string, includePermissions = true) {
    const role = await this.prisma.role.findUnique({
      where: { name },
      include: {
        permissions: includePermissions
          ? {
              include: {
                permission: true,
              },
            }
          : false,
      },
    });

    if (!role) {
      throw new NotFoundException(`名前: "${name}" のロールは存在しません`);
    }

    return role;
  }

  /**
   * 新しいロールを作成します
   * @param createRoleDto ロール作成データ
   * @returns 作成されたロール
   */
  async create(createRoleDto: CreateRoleDto) {
    // 同名のロールが存在するか確認
    const existingRole = await this.prisma.role.findUnique({
      where: { name: createRoleDto.name },
    });

    if (existingRole) {
      throw new ConflictException(
        `名前: "${createRoleDto.name}" のロールは既に存在します`
      );
    }

    // 権限が指定されている場合、それらが存在するか確認
    let permissions: Permission[] = [];
    if (createRoleDto.permissions && createRoleDto.permissions.length > 0) {
      permissions = await this.prisma.permission.findMany({
        where: { name: { in: createRoleDto.permissions } },
      });

      // 見つからない権限があるか確認
      const foundPermissionNames = permissions.map((p) => p.name);
      const missingPermissions = createRoleDto.permissions.filter(
        (p) => !foundPermissionNames.includes(p)
      );

      if (missingPermissions.length > 0) {
        throw new NotFoundException(
          `以下の権限は存在しません: ${missingPermissions.join(', ')}`
        );
      }
    }

    // トランザクション内でロールと権限の関連付けを作成
    return this.prisma.$transaction(async (prisma) => {
      // ロールを作成
      const role = await prisma.role.create({
        data: {
          name: createRoleDto.name,
          description: createRoleDto.description,
        },
      });

      // 権限が指定されている場合、ロールと権限を関連付け
      if (permissions.length > 0) {
        await Promise.all(
          permissions.map((permission) =>
            prisma.rolePermission.create({
              data: {
                roleId: role.id,
                permissionId: permission.id,
              },
            })
          )
        );
      }

      // 作成したロールを権限情報と共に返す
      return prisma.role.findUnique({
        where: { id: role.id },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });
    });
  }

  /**
   * 指定されたロールを更新します
   * @param id ロールID
   * @param updateRoleDto 更新データ
   * @returns 更新されたロール
   */
  async update(id: number, updateRoleDto: UpdateRoleDto) {
    // ロールが存在するか確認
    const role = await this.prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      throw new NotFoundException(`ID: ${id} のロールは存在しません`);
    }

    // 名前が変更される場合、同名のロールが存在しないか確認
    if (updateRoleDto.name && updateRoleDto.name !== role.name) {
      const existingRole = await this.prisma.role.findUnique({
        where: { name: updateRoleDto.name },
      });

      if (existingRole) {
        throw new ConflictException(
          `名前: "${updateRoleDto.name}" のロールは既に存在します`
        );
      }
    }

    // 権限が指定されている場合、それらが存在するか確認
    let permissions: Permission[] = [];
    if (updateRoleDto.permissions && updateRoleDto.permissions.length > 0) {
      permissions = await this.prisma.permission.findMany({
        where: { name: { in: updateRoleDto.permissions } },
      });

      // 見つからない権限があるか確認
      const foundPermissionNames = permissions.map((p) => p.name);
      const missingPermissions = updateRoleDto.permissions.filter(
        (p) => !foundPermissionNames.includes(p)
      );

      if (missingPermissions.length > 0) {
        throw new NotFoundException(
          `以下の権限は存在しません: ${missingPermissions.join(', ')}`
        );
      }
    }

    // トランザクション内でロールと権限を更新
    return this.prisma.$transaction(async (prisma) => {
      // ロールを更新
      const updatedRole = await prisma.role.update({
        where: { id },
        data: {
          name: updateRoleDto.name,
          description: updateRoleDto.description,
        },
      });

      // 権限が指定されている場合、既存の権限関連をすべて削除して新しい関連を作成
      if (updateRoleDto.permissions !== undefined) {
        // 既存の権限関連を削除
        await prisma.rolePermission.deleteMany({
          where: { roleId: id },
        });

        // 新しい権限関連を作成
        if (permissions.length > 0) {
          await Promise.all(
            permissions.map((permission) =>
              prisma.rolePermission.create({
                data: {
                  roleId: updatedRole.id,
                  permissionId: permission.id,
                },
              })
            )
          );
        }
      }

      // 更新したロールを権限情報と共に返す
      return prisma.role.findUnique({
        where: { id: updatedRole.id },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });
    });
  }

  /**
   * 指定されたロールを削除します
   * @param id ロールID
   * @returns 削除されたロール
   */
  async delete(id: number) {
    // ロールが存在するか確認
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: true,
        users: true,
      },
    });

    if (!role) {
      throw new NotFoundException(`ID: ${id} のロールは存在しません`);
    }

    // トランザクション内でロールとその関連を削除
    return this.prisma.$transaction(async (prisma) => {
      // ロールと権限の関連を削除
      await prisma.rolePermission.deleteMany({
        where: { roleId: id },
      });

      // ユーザーとロールの関連を削除
      await prisma.userRole.deleteMany({
        where: { roleId: id },
      });

      // ロールを削除
      return prisma.role.delete({
        where: { id },
      });
    });
  }

  /**
   * 指定されたユーザーにロールを割り当てます
   * @param userId ユーザーID
   * @param roleId ロールID
   * @returns 作成されたユーザーロール関連
   */
  async assignRoleToUser(userId: number, roleId: number) {
    // ユーザーが存在するか確認
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`ID: ${userId} のユーザーは存在しません`);
    }

    // ロールが存在するか確認
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException(`ID: ${roleId} のロールは存在しません`);
    }

    // 既に割り当てられているか確認
    const existingAssignment = await this.prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
    });

    if (existingAssignment) {
      throw new ConflictException(
        `ユーザー(ID: ${userId})には既にロール(ID: ${roleId})が割り当てられています`
      );
    }

    // ユーザーにロールを割り当て
    return this.prisma.userRole.create({
      data: {
        userId,
        roleId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        role: true,
      },
    });
  }

  /**
   * 指定されたユーザーからロールを削除します
   * @param userId ユーザーID
   * @param roleId ロールID
   * @returns 削除されたユーザーロール関連
   */
  async removeRoleFromUser(userId: number, roleId: number) {
    // ユーザーとロールの関連が存在するか確認
    const userRole = await this.prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
    });

    if (!userRole) {
      throw new NotFoundException(
        `ユーザー(ID: ${userId})にはロール(ID: ${roleId})が割り当てられていません`
      );
    }

    // ユーザーからロールを削除
    return this.prisma.userRole.delete({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        role: true,
      },
    });
  }

  /**
   * 指定されたユーザーのすべてのロールを取得します
   * @param userId ユーザーID
   * @returns ユーザーのロール配列
   */
  async getUserRoles(userId: number) {
    // ユーザーが存在するか確認
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`ID: ${userId} のユーザーは存在しません`);
    }

    // ユーザーのロールを取得
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    return userRoles.map((userRole) => userRole.role);
  }

  /**
   * 指定されたユーザーが指定されたロールを持っているか確認します
   * @param userId ユーザーID
   * @param roleName ロール名
   * @returns ロールを持っている場合はtrue
   */
  async userHasRole(userId: number, roleName: string): Promise<boolean> {
    const count = await this.prisma.userRole.count({
      where: {
        userId,
        role: {
          name: roleName,
        },
      },
    });

    return count > 0;
  }

  /**
   * 指定されたユーザーが指定された権限を持っているか確認します
   * （ユーザーのいずれかのロールに権限が含まれているか）
   * @param userId ユーザーID
   * @param permissionName 権限名
   * @returns 権限を持っている場合はtrue
   */
  async userHasPermission(
    userId: number,
    permissionName: string
  ): Promise<boolean> {
    const count = await this.prisma.userRole.count({
      where: {
        userId,
        role: {
          permissions: {
            some: {
              permission: {
                name: permissionName,
              },
            },
          },
        },
      },
    });

    return count > 0;
  }

  /**
   * すべての権限を取得します
   * @returns 権限の配列
   */
  async getAllPermissions() {
    return await this.prisma.permission.findMany();
  }
}
