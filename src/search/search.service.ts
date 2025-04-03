// src/search/search.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  /**
   * ユーザーを検索（日本語対応）
   */
  async searchUsers(
    query: string,
    page = 1,
    limit = 10,
    orderBy: 'relevance' | 'recent' = 'relevance'
  ) {
    const skip = (page - 1) * limit;

    // pg_bigmを使用した日本語対応検索
    const users = await this.prisma.$queryRaw`
      SELECT 
        id, 
        username, 
        "displayName", 
        "profileImage", 
        "createdAt",
        GREATEST(
          SIMILARITY(username, ${query}),
          SIMILARITY(COALESCE("displayName", ''), ${query})
        ) as similarity
      FROM "User"
      WHERE 
        username LIKE ${`%${query}%`} OR 
        "displayName" LIKE ${`%${query}%`}
      ORDER BY 
        ${orderBy === 'relevance' ? Prisma.raw('similarity DESC') : Prisma.raw('"createdAt" DESC')}
      LIMIT ${limit} OFFSET ${skip}
    `;

    // 結果の総数を取得
    const totalCount = await this.prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM "User"
      WHERE 
        username LIKE ${`%${query}%`} OR 
        "displayName" LIKE ${`%${query}%`}
    `;

    return {
      data: users,
      meta: {
        total: Number(totalCount[0].count),
        page,
        limit,
        orderBy,
      },
    };
  }

  /**
   * 投稿を検索（日本語対応）
   */
  async searchPosts(
    query: string,
    page = 1,
    limit = 10,
    orderBy: 'relevance' | 'recent' = 'relevance'
  ) {
    const skip = (page - 1) * limit;

    // pg_bigmを使用した日本語対応検索
    const posts = await this.prisma.$queryRaw`
      SELECT 
        p.id, 
        p.content, 
        p."createdAt", 
        p."userId",
        u.username, 
        u."displayName", 
        u."profileImage",
        SIMILARITY(p.content, ${query}) as similarity
      FROM "Post" p
      JOIN "User" u ON p."userId" = u.id
      WHERE p.content LIKE ${`%${query}%`}
      ORDER BY 
        ${orderBy === 'relevance' ? Prisma.raw('similarity DESC') : Prisma.raw('p."createdAt" DESC')}
      LIMIT ${limit} OFFSET ${skip}
    `;

    // 結果の総数を取得
    const totalCount = await this.prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM "Post"
      WHERE content LIKE ${`%${query}%`}
    `;

    return {
      data: posts,
      meta: {
        total: Number(totalCount[0].count),
        page,
        limit,
        orderBy,
      },
    };
  }

  /**
   * コメントを検索（日本語対応）
   */
  async searchComments(
    query: string,
    page = 1,
    limit = 10,
    orderBy: 'relevance' | 'recent' = 'relevance'
  ) {
    const skip = (page - 1) * limit;

    // pg_bigmを使用した日本語対応検索
    const comments = await this.prisma.$queryRaw`
      SELECT 
        c.id, 
        c.content, 
        c."createdAt", 
        c."userId",
        c."postId",
        u.username, 
        u."displayName", 
        u."profileImage",
        p.content as "postContent",
        SIMILARITY(c.content, ${query}) as similarity
      FROM "Comment" c
      JOIN "User" u ON c."userId" = u.id
      JOIN "Post" p ON c."postId" = p.id
      WHERE c.content LIKE ${`%${query}%`}
      ORDER BY 
        ${orderBy === 'relevance' ? Prisma.raw('similarity DESC') : Prisma.raw('c."createdAt" DESC')}
      LIMIT ${limit} OFFSET ${skip}
    `;

    // 結果の総数を取得
    const totalCount = await this.prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM "Comment"
      WHERE content LIKE ${`%${query}%`}
    `;

    return {
      data: comments,
      meta: {
        total: Number(totalCount[0].count),
        page,
        limit,
        orderBy,
      },
    };
  }

  /**
   * すべてのコンテンツタイプを横断的に検索（日本語対応）
   */
  async searchAll(query: string, page = 1, limit = 10) {
    // 各コンテンツタイプを検索
    const [users, posts, comments] = await Promise.all([
      this.searchUsers(query, 1, 5, 'relevance'),
      this.searchPosts(query, 1, 5, 'relevance'),
      this.searchComments(query, 1, 5, 'relevance'),
    ]);

    return {
      users: users.data,
      posts: posts.data,
      comments: comments.data,
      meta: {
        users: { total: users.meta.total },
        posts: { total: posts.meta.total },
        comments: { total: comments.meta.total },
      },
    };
  }

  /**
   * ブックマークした投稿を検索（日本語対応）
   */
  async searchBookmarkedPosts(
    userId: number,
    query: string,
    page = 1,
    limit = 10
  ) {
    const skip = (page - 1) * limit;

    // ユーザーがブックマークした投稿を検索
    const posts = await this.prisma.$queryRaw`
      SELECT 
        p.id, 
        p.content, 
        p."createdAt", 
        p."userId",
        u.username, 
        u."displayName", 
        u."profileImage",
        b."createdAt" as "bookmarkedAt",
        SIMILARITY(p.content, ${query}) as similarity
      FROM "Bookmark" b
      JOIN "Post" p ON b."postId" = p.id
      JOIN "User" u ON p."userId" = u.id
      WHERE 
        b."userId" = ${userId} AND
        p.content LIKE ${`%${query}%`}
      ORDER BY similarity DESC, b."createdAt" DESC
      LIMIT ${limit} OFFSET ${skip}
    `;

    // 結果の総数を取得
    const totalCount = await this.prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM "Bookmark" b
      JOIN "Post" p ON b."postId" = p.id
      WHERE 
        b."userId" = ${userId} AND
        p.content LIKE ${`%${query}%`}
    `;

    return {
      data: posts,
      meta: {
        total: Number(totalCount[0].count),
        page,
        limit,
      },
    };
  }

  /**
   * タイムライン（フォロー中ユーザーの投稿）を検索（日本語対応）
   */
  async searchTimelinePosts(
    userId: number,
    query: string,
    page = 1,
    limit = 10
  ) {
    const skip = (page - 1) * limit;

    const posts = await this.prisma.$queryRaw`
      SELECT 
        p.id, 
        p.content, 
        p."createdAt", 
        p."userId",
        u.username, 
        u."displayName", 
        u."profileImage",
        SIMILARITY(p.content, ${query}) as similarity
      FROM "Post" p
      JOIN "User" u ON p."userId" = u.id
      WHERE 
        p.content LIKE ${`%${query}%`} AND
        (
          p."userId" = ${userId} OR
          p."userId" IN (
            SELECT "followingId" FROM "Follow" WHERE "followerId" = ${userId}
          )
        )
      ORDER BY similarity DESC, p."createdAt" DESC
      LIMIT ${limit} OFFSET ${skip}
    `;

    // 結果の総数を取得
    const totalCount = await this.prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM "Post" p
      WHERE 
        p.content LIKE ${`%${query}%`} AND
        (
          p."userId" = ${userId} OR
          p."userId" IN (
            SELECT "followingId" FROM "Follow" WHERE "followerId" = ${userId}
          )
        )
    `;

    return {
      data: posts,
      meta: {
        total: Number(totalCount[0].count),
        page,
        limit,
      },
    };
  }

  /**
   * キーワードのサジェスト機能（日本語対応）
   */
  async suggestKeywords(partialQuery: string, limit = 5) {
    if (!partialQuery || partialQuery.length < 2) {
      return { suggestions: [] };
    }

    // ユーザー名、表示名、投稿内容から関連する単語を抽出
    const usernameSuggestions = await this.prisma.$queryRaw`
      SELECT DISTINCT username as suggestion, SIMILARITY(username, ${partialQuery}) as score
      FROM "User"
      WHERE username LIKE ${`%${partialQuery}%`}
      ORDER BY score DESC
      LIMIT ${Math.floor(limit / 3)}
    `;

    const displayNameSuggestions = await this.prisma.$queryRaw`
      SELECT DISTINCT "displayName" as suggestion, SIMILARITY("displayName", ${partialQuery}) as score
      FROM "User"
      WHERE "displayName" LIKE ${`%${partialQuery}%`} AND "displayName" IS NOT NULL
      ORDER BY score DESC
      LIMIT ${Math.floor(limit / 3)}
    `;

    const contentSuggestions = await this.prisma.$queryRaw`
      SELECT DISTINCT 
        CASE 
          WHEN length(content) <= 20 THEN content
          ELSE substring(content, 1, 20) || '...'
        END as suggestion,
        SIMILARITY(content, ${partialQuery}) as score
      FROM "Post"
      WHERE content LIKE ${`%${partialQuery}%`}
      ORDER BY score DESC
      LIMIT ${Math.ceil(limit / 3)}
    `;

    // 結果を結合して重複を排除
    const allSuggestions = [
      ...usernameSuggestions,
      ...displayNameSuggestions,
      ...contentSuggestions,
    ]
      .filter((s) => s.suggestion) // nullや空文字を除外
      .sort((a, b) => b.score - a.score) // スコアの高い順にソート
      .slice(0, limit); // 指定された数に制限

    return { suggestions: allSuggestions.map((s) => s.suggestion) };
  }
  async fuzzySearchUsers(query: string, page: number, limit: number) {
    // Implement fuzzy search logic here
    // For example, using Prisma with case-insensitive search:
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          // Add other fields you want to fuzzy search
        ],
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await this.prisma.user.count({
      where: {
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
    });

    return {
      users,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }
}
