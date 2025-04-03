import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('users')
  async searchUsers(
    @Query('q') query: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ) {
    return this.searchService.searchUsers(query, page, limit);
  }

  @Get('posts')
  async searchPosts(
    @Query('q') query: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ) {
    return this.searchService.searchPosts(query, page, limit);
  }

  @Get('users/fuzzy')
  async fuzzySearchUsers(
    @Query('q') query: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ) {
    return await this.searchService.fuzzySearchUsers(query, page, limit);
  }
}
