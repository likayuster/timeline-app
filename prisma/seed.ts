/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Prismaクライアントのインスタンスを作成
const prisma = new PrismaClient();

/**
 * 基本的なロール定義
 */
const roles = [
  {
    name: 'admin',
    description: '管理者ロール。システム全体の管理権限を持ちます。',
  },
  {
    name: 'moderator',
    description: 'モデレーターロール。コンテンツの管理権限を持ちます。',
  },
  {
    name: 'user',
    description: '一般ユーザーロール。基本的な機能のみ使用できます。',
  },
];

/**
 * 基本的な権限定義
 */
const permissions = [
  // ユーザー管理権限
  { name: 'read:users', description: 'ユーザー情報の閲覧権限' },
  { name: 'create:users', description: 'ユーザー作成権限' },
  { name: 'update:users', description: 'ユーザー情報更新権限' },
  { name: 'delete:users', description: 'ユーザー削除権限' },

  // 投稿管理権限
  { name: 'read:posts', description: '投稿の閲覧権限' },
  { name: 'create:posts', description: '投稿作成権限' },
  { name: 'update:posts', description: '投稿更新権限' },
  { name: 'delete:posts', description: '投稿削除権限' },
  { name: 'delete:any-post', description: '任意のユーザーの投稿削除権限' },

  // コメント管理権限
  { name: 'read:comments', description: 'コメントの閲覧権限' },
  { name: 'create:comments', description: 'コメント作成権限' },
  { name: 'update:comments', description: 'コメント更新権限' },
  { name: 'delete:comments', description: 'コメント削除権限' },
  {
    name: 'delete:any-comment',
    description: '任意のユーザーのコメント削除権限',
  },

  // ロール管理権限
  { name: 'read:roles', description: 'ロール情報の閲覧権限' },
  { name: 'assign:roles', description: 'ロール割り当て権限' },
  { name: 'create:roles', description: 'ロール作成権限' },
  { name: 'update:roles', description: 'ロール更新権限' },
  { name: 'delete:roles', description: 'ロール削除権限' },
];

/**
 * ロールごとの権限マッピング
 */
const rolePermissions = {
  admin: permissions.map((p) => p.name), // 管理者はすべての権限を持つ

  moderator: [
    'read:users',
    'read:posts',
    'update:posts',
    'delete:any-post',
    'read:comments',
    'update:comments',
    'delete:any-comment',
    'read:roles',
  ],

  user: [
    'read:posts',
    'create:posts',
    'update:posts',
    'delete:posts',
    'read:comments',
    'create:comments',
    'update:comments',
    'delete:comments',
  ],
};

/**
 * 初期管理者ユーザー
 */
const adminUser = {
  email: 'admin@example.com',
  username: 'admin',
  displayName: '管理者',
  password: 'Admin123!', // 本番環境では、強力で一意なパスワードを使用してください
  bio: 'システム管理者です。',
};

/**
 * メイン実行関数
 */
async function main() {
  console.log(`データベースのシードを開始します...`);

  try {
    // ステップ1: ロールの作成
    console.log('基本ロールを作成中...');

    const createdRoles: Role[] = await Promise.all(
      roles.map(async (role) => {
        return await prisma.role.upsert({
          where: { name: role.name },
          update: role,
          create: role,
        });
      })
    );
    console.log(`${createdRoles.length}個のロールを作成しました`);

    // ステップ2: 権限の作成
    console.log('基本権限を作成中...');
    const createdPermissions = await Promise.all(
      permissions.map(async (permission) => {
        return await prisma.permission.upsert({
          where: { name: permission.name },
          update: permission, // 既存の場合は更新
          create: permission, // 存在しない場合は作成
        });
      })
    );
    console.log(`${createdPermissions.length}個の権限を作成しました`);

    // ステップ3: ロールと権限の関連付け
    console.log('ロールと権限を関連付け中...');
    for (const [roleName, permissionNames] of Object.entries(rolePermissions)) {
      const role = await prisma.role.findUnique({
        where: { name: roleName },
      });

      if (!role) {
        console.warn(`警告: ロール "${roleName}" が見つかりません`);
        continue;
      }

      // 既存の関連付けを削除
      await prisma.rolePermission.deleteMany({
        where: { roleId: role.id },
      });

      // 新しい関連付けを作成
      for (const permissionName of permissionNames) {
        const permission = await prisma.permission.findUnique({
          where: { name: permissionName },
        });

        if (!permission) {
          console.warn(`警告: 権限 "${permissionName}" が見つかりません`);
          continue;
        }

        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permission.id,
          },
        });
      }
    }
    console.log('ロールと権限の関連付けが完了しました');

    // ステップ4: 管理者ユーザーの作成
    console.log('管理者ユーザーを作成中...');

    // パスワードのハッシュ化
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(adminUser.password, saltRounds);

    // 管理者ユーザーのupsert
    const admin = await prisma.user.upsert({
      where: { email: adminUser.email },
      update: {
        username: adminUser.username,
        displayName: adminUser.displayName,
        passwordHash,
        bio: adminUser.bio,
      },
      create: {
        email: adminUser.email,
        username: adminUser.username,
        displayName: adminUser.displayName,
        passwordHash,
        bio: adminUser.bio,
      },
    });
    console.log(`管理者ユーザー (ID: ${admin.id}) を作成/更新しました`);

    // ステップ5: 管理者ユーザーにadminロールを割り当て
    console.log('管理者ユーザーにadminロールを割り当て中...');
    const adminRole = await prisma.role.findUnique({
      where: { name: 'admin' },
    });

    if (!adminRole) {
      throw new Error('adminロールが見つかりません');
    }

    // 現在のロール割り当てを確認
    const existingRole = await prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId: admin.id,
          roleId: adminRole.id,
        },
      },
    });

    // 割り当てが存在しない場合のみ作成
    if (!existingRole) {
      await prisma.userRole.create({
        data: {
          userId: admin.id,
          roleId: adminRole.id,
        },
      });
      console.log('管理者ユーザーにadminロールを割り当てました');
    } else {
      console.log('管理者ユーザーは既にadminロールを持っています');
    }

    console.log('データベースのシードが正常に完了しました');
  } catch (error) {
    console.error('シード処理中にエラーが発生しました:', error);
    process.exit(1);
  } finally {
    // データベース接続を閉じる
    await prisma.$disconnect();
  }
}

// メイン関数を実行
main()
  .catch((e) => {
    console.error('シードスクリプトの実行に失敗しました:', e);
    process.exit(1);
  })
  .finally(() => {
    // void演算子でPromiseを無視
    void prisma.$disconnect();
  });
