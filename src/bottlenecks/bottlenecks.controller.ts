import { Controller, Get, Post, Param, ParseIntPipe, Query } from '@nestjs/common';
import { BottlenecksService } from './bottlenecks.service';

@Controller('bottlenecks')
export class BottlenecksController {
  constructor(private readonly service: BottlenecksService) {}

  // Seed the database
  @Post('seed')
  seed() {
    return this.service.seed();
  }

  // ── Bottleneck 1: Multiple PrismaClient Instances ───────────────
  @Get('connection-pool/bad')
  getUsersBad() {
    return this.service.getUsersBad();
  }

  @Get('connection-pool/good')
  getUsersGood() {
    return this.service.getUsersGood();
  }

  // ── Bottleneck 2: N+1 Query Problem ────────────────────────────
  @Get('n-plus-1/bad')
  getPostsWithAuthorsBad() {
    return this.service.getPostsWithAuthorsBad();
  }

  @Get('n-plus-1/good')
  getPostsWithAuthorsGood() {
    return this.service.getPostsWithAuthorsGood();
  }

  // ── Bottleneck 3: Over-fetching ─────────────────────────────────
  @Get('overfetch/bad')
  getUsersOverfetchBad() {
    return this.service.getUsersOverfetchBad();
  }

  @Get('overfetch/good')
  getUsersOverfetchGood() {
    return this.service.getUsersOverfetchGood();
  }

  // ── Bottleneck 4: No Pagination ─────────────────────────────────
  @Get('pagination/no-limit/bad')
  getPostsNoPaginationBad() {
    return this.service.getPostsNoPaginationBad();
  }

  @Get('pagination/cursor/good')
  getPostsWithCursorPagination(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getPostsWithCursorPaginationGood(
      cursor ? parseInt(cursor, 10) : undefined,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  // ── Bottleneck 5: Offset Pagination ─────────────────────────────
  @Get('pagination/offset/bad')
  getPostsOffsetPaginationBad(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    return this.service.getPostsOffsetPaginationBad(
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  // ── Bottleneck 6: Long Transactions ────────────────────────────
  @Get('long-transaction/bad/:userId')
  longTransactionBad(@Param('userId', ParseIntPipe) userId: number) {
    return this.service.longTransactionBad(userId);
  }

  @Get('long-transaction/good/:userId')
  longTransactionGood(@Param('userId', ParseIntPipe) userId: number) {
    return this.service.longTransactionGood(userId);
  }

  // ── Bottleneck 7: Race Condition ────────────────────────────────
  @Get('race-condition/bad/:productId')
  decrementStockBad(
    @Param('productId', ParseIntPipe) productId: number,
    @Query('qty') qty = '1',
  ) {
    return this.service.decrementStockBad(productId, parseInt(qty, 10));
  }

  @Get('race-condition/good/:productId')
  decrementStockGood(
    @Param('productId', ParseIntPipe) productId: number,
    @Query('qty') qty = '1',
  ) {
    return this.service.decrementStockGood(productId, parseInt(qty, 10));
  }

  // ── Bottleneck 8: Deep Include Without Select ───────────────────
  @Get('deep-include/bad')
  getOrdersDeepFetchBad() {
    return this.service.getOrdersDeepFetchBad();
  }

  @Get('deep-include/good')
  getOrdersDeepFetchGood() {
    return this.service.getOrdersDeepFetchGood();
  }

  // ── Bottleneck 9: Sequential Await ─────────────────────────────
  @Get('sequential-await/bad')
  getDashboardDataBad() {
    return this.service.getDashboardDataBad();
  }

  @Get('sequential-await/good')
  getDashboardDataGood() {
    return this.service.getDashboardDataGood();
  }

  // ── Bottleneck 10: Unindexed WHERE ─────────────────────────────
  @Get('unindexed-where/bad')
  getPublishedPostsBad() {
    return this.service.getPublishedPostsBad();
  }

  @Get('unindexed-where/good')
  getPublishedPostsGood() {
    return this.service.getPublishedPostsGood();
  }

  // ── Bottleneck 11: Max Parameters ──────────────────────────────
  @Get('max-params/bad')
  bulkInsertBad(@Query('count') count = '5000') {
    return this.service.bulkInsertBad(parseInt(count, 10));
  }

  @Get('max-params/good')
  bulkInsertGood(@Query('count') count = '5000') {
    return this.service.bulkInsertGood(parseInt(count, 10));
  }

  // ── Bottleneck 12: Engine Startup / Cold Start ─────────────────
  @Get('cold-start/bad')
  coldStartBad() {
    return this.service.coldStartBad();
  }

  @Get('cold-start/good')
  coldStartGood() {
    return this.service.coldStartGood();
  }

  // ── Bottleneck 13: In-Memory Sorting ───────────────────────────
  @Get('in-memory-sort/bad')
  getPostsSortedBad() {
    return this.service.getPostsSortedBad();
  }

  @Get('in-memory-sort/good')
  getPostsSortedGood() {
    return this.service.getPostsSortedGood();
  }
}
