import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import * as path from 'path';

/**
 * This service demonstrates common Prisma bottlenecks in high-concurrency
 * NestJS applications. Each method shows a "bad" pattern and a "good" pattern.
 */
@Injectable()
export class BottlenecksService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────
  // BOTTLENECK 1: Multiple PrismaClient Instances (Connection Pool Exhaustion)
  // ─────────────────────────────────────────────────────────────────

  /**
   * BAD: Creates a new PrismaClient instance per request.
   * Every request opens its own connection pool, quickly exhausting
   * the database connection limit under high concurrency.
   */
  async getUsersBad(): Promise<{ queryTime: number; warning: string }> {
    const start = Date.now();

    // Anti-pattern: instantiate PrismaClient inside a service method
    const localPrisma = new PrismaClient({
      adapter: new PrismaBetterSqlite3({
        url: `file:${path.join(__dirname, '../../prisma/dev.db')}`,
      }),
    });

    await localPrisma.$connect();
    const users = await localPrisma.user.findMany({ take: 5 });
    await localPrisma.$disconnect();

    return {
      queryTime: Date.now() - start,
      warning:
        'ANTI-PATTERN: New PrismaClient per request. ' +
        `Fetched ${users.length} users. ` +
        'Each request creates its own connection pool, exhausting DB connections under load.',
    };
  }

  /**
   * GOOD: Reuses the singleton PrismaService injected by NestJS DI.
   * One shared pool for the entire application lifecycle.
   */
  async getUsersGood(): Promise<{ queryTime: number; info: string }> {
    const start = Date.now();
    const users = await this.prisma.user.findMany({ take: 5 });
    return {
      queryTime: Date.now() - start,
      info:
        `GOOD: Shared singleton PrismaService. Fetched ${users.length} users. ` +
        'Connection pool is reused across all requests.',
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // BOTTLENECK 2: N+1 Query Problem
  // ─────────────────────────────────────────────────────────────────

  /**
   * BAD: Fetches users first, then queries posts for EACH user separately.
   * With 100 users, this fires 101 SQL queries (1 + N).
   */
  async getPostsWithAuthorsBad(): Promise<{ queryCount: number; queryTime: number; warning: string }> {
    const start = Date.now();
    const users = await this.prisma.user.findMany();
    const results: any[] = [];

    // N+1: one additional query per user
    for (const user of users) {
      const posts = await this.prisma.post.findMany({
        where: { authorId: user.id },
      });
      results.push({ user, posts });
    }

    return {
      queryCount: users.length + 1, // 1 for findMany + N for each user
      queryTime: Date.now() - start,
      warning:
        `ANTI-PATTERN: N+1 queries. Fired ${users.length + 1} SQL queries for ${users.length} users. ` +
        'This explodes at scale.',
    };
  }

  /**
   * GOOD: Uses Prisma `include` to fetch users and their posts in 2 queries.
   */
  async getPostsWithAuthorsGood(): Promise<{ queryCount: number; queryTime: number; info: string }> {
    const start = Date.now();
    const usersWithPosts = await this.prisma.user.findMany({
      include: {
        posts: {
          select: { id: true, title: true, published: true },
        },
      },
    });

    return {
      queryCount: 2, // 1 for users + 1 for all posts in a single IN query
      queryTime: Date.now() - start,
      info:
        `GOOD: Uses include. Fetched ${usersWithPosts.length} users with posts in 2 queries. ` +
        'Prisma batches the posts lookup into a single IN clause.',
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // BOTTLENECK 3: Over-fetching (Selecting Too Many Columns)
  // ─────────────────────────────────────────────────────────────────

  /**
   * BAD: Fetches every column on every row, even if the caller only needs IDs and names.
   * In production, large TEXT/BLOB columns waste network and memory bandwidth.
   */
  async getUsersOverfetchBad(): Promise<{ queryTime: number; bytesWasted: string; warning: string }> {
    const start = Date.now();
    const users = await this.prisma.user.findMany(); // selects ALL columns

    return {
      queryTime: Date.now() - start,
      bytesWasted: 'Transferring createdAt, email for all rows unnecessarily',
      warning:
        'ANTI-PATTERN: No select clause. All columns fetched even though only id+name are needed.',
    };
  }

  /**
   * GOOD: Explicitly selects only the columns required by the caller.
   */
  async getUsersOverfetchGood(): Promise<{ queryTime: number; info: string }> {
    const start = Date.now();
    const users = await this.prisma.user.findMany({
      select: { id: true, name: true }, // only what we need
    });

    return {
      queryTime: Date.now() - start,
      info:
        `GOOD: Explicit select. Fetched ${users.length} users with only id and name columns. ` +
        'Dramatically reduces data transfer for wide tables.',
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // BOTTLENECK 4: Missing Pagination (Unbounded Queries)
  // ─────────────────────────────────────────────────────────────────

  /**
   * BAD: Returns ALL rows without any limit. Under load, this can return
   * millions of rows and OOM the Node.js process.
   */
  async getPostsNoPaginationBad(): Promise<{ count: number; queryTime: number; warning: string }> {
    const start = Date.now();
    const posts = await this.prisma.post.findMany(); // NO LIMIT

    return {
      count: posts.length,
      queryTime: Date.now() - start,
      warning:
        'ANTI-PATTERN: No pagination/limit. With 1M rows this query kills your server.',
    };
  }

  /**
   * GOOD: Cursor-based pagination for stable, performant paging.
   * Offset pagination degrades as offset grows; cursor-based stays fast.
   */
  async getPostsWithCursorPaginationGood(
    cursor?: number,
    limit = 10,
  ): Promise<{ posts: any[]; nextCursor: number | null; queryTime: number; info: string }> {
    const start = Date.now();
    const posts = await this.prisma.post.findMany({
      take: limit + 1, // fetch one extra to determine if there's a next page
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, title: true, published: true, createdAt: true },
    });

    const hasNextPage = posts.length > limit;
    const page = hasNextPage ? posts.slice(0, limit) : posts;
    const nextCursor = hasNextPage ? page[page.length - 1].id : null;

    return {
      posts: page,
      nextCursor,
      queryTime: Date.now() - start,
      info:
        `GOOD: Cursor-based pagination. Page size=${limit}, nextCursor=${nextCursor}. ` +
        'O(1) cost regardless of dataset size. No offset drift.',
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // BOTTLENECK 5: Offset Pagination at Scale
  // ─────────────────────────────────────────────────────────────────

  /**
   * BAD: OFFSET pagination makes the DB scan and discard all preceding rows.
   * OFFSET 100000 LIMIT 10 means the DB reads 100,010 rows and throws 100,000 away.
   */
  async getPostsOffsetPaginationBad(
    page: number,
    limit = 10,
  ): Promise<{ posts: any[]; queryTime: number; warning: string }> {
    const start = Date.now();
    const skip = (page - 1) * limit;
    const posts = await this.prisma.post.findMany({
      skip,
      take: limit,
      orderBy: { id: 'asc' },
    });

    return {
      posts,
      queryTime: Date.now() - start,
      warning:
        `ANTI-PATTERN: OFFSET pagination. skip=${skip} forces full table scan. ` +
        'Doubles query time every time the page depth doubles.',
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // BOTTLENECK 6: Long-Running Transactions Holding Connections
  // ─────────────────────────────────────────────────────────────────

  /**
   * BAD: Holds a transaction open while doing external I/O (simulated by setTimeout).
   * During that wait, the DB connection is locked. Under concurrency, this starves
   * other requests of available connections from the pool.
   */
  async longTransactionBad(userId: number): Promise<{ queryTime: number; warning: string }> {
    const start = Date.now();

    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });

      // Simulate expensive external call INSIDE the transaction (e.g., HTTP, email service)
      await new Promise((resolve) => setTimeout(resolve, 100));

      await tx.user.update({
        where: { id: userId },
        data: { name: user?.name ?? 'Updated' },
      });
    });

    return {
      queryTime: Date.now() - start,
      warning:
        'ANTI-PATTERN: External I/O inside transaction. ' +
        'Connection held for 100ms+ per request. Under 50 concurrent requests, pool is exhausted.',
    };
  }

  /**
   * GOOD: Perform external I/O BEFORE the transaction. Keep transactions short and atomic.
   */
  async longTransactionGood(userId: number): Promise<{ queryTime: number; info: string }> {
    const start = Date.now();

    // Do external work BEFORE opening the transaction
    await new Promise((resolve) => setTimeout(resolve, 100));
    const newName = `Updated-${Date.now()}`;

    // Short, fast transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { name: newName },
      });
    });

    return {
      queryTime: Date.now() - start,
      info:
        'GOOD: External I/O done before transaction. ' +
        'Transaction completes in <5ms. Connection released immediately.',
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // BOTTLENECK 7: Race Condition on Inventory (Missing Transactions)
  // ─────────────────────────────────────────────────────────────────

  /**
   * BAD: Read-then-write without a transaction causes race conditions.
   * Two concurrent requests could both read stock=5, both decrement, and
   * both write 4 — losing an inventory decrement (lost update).
   */
  async decrementStockBad(productId: number, quantity: number): Promise<{ result: any; warning: string }> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });

    if (!product || product.stock < quantity) {
      return { result: null, warning: 'ANTI-PATTERN: Insufficient stock (but race possible).' };
    }

    // Race window: another request could decrement between our read and write
    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: { stock: product.stock - quantity },
    });

    return {
      result: updated,
      warning:
        'ANTI-PATTERN: Read-then-write without transaction. ' +
        'Concurrent requests can both read the same stock value and both commit, overselling.',
    };
  }

  /**
   * GOOD: Atomic update using Prisma increment/decrement eliminates the race window.
   * The database performs the decrement atomically in a single SQL statement.
   */
  async decrementStockGood(productId: number, quantity: number): Promise<{ result: any; info: string }> {
    try {
      const updated = await this.prisma.product.update({
        where: {
          id: productId,
          stock: { gte: quantity }, // guard in WHERE clause — atomic check+update
        },
        data: {
          stock: { decrement: quantity }, // single atomic SQL: SET stock = stock - ?
        },
      });

      return {
        result: updated,
        info:
          'GOOD: Atomic decrement. Single SQL statement: UPDATE WHERE stock >= ?. ' +
          'No race condition possible. Failed updates return null safely.',
      };
    } catch {
      return {
        result: null,
        info: 'Atomic update failed — stock insufficient or product not found.',
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // BOTTLENECK 8: Ignoring `select` in Nested Relations (Deep Over-fetching)
  // ─────────────────────────────────────────────────────────────────

  /**
   * BAD: Includes all nested relations without select, pulling every column
   * across multiple tables. With deeply nested models this multiplies rapidly.
   */
  async getOrdersDeepFetchBad(): Promise<{ queryTime: number; warning: string }> {
    const start = Date.now();
    const orders = await this.prisma.order.findMany({
      include: {
        user: true,          // all user columns
        items: {
          include: {
            product: true,  // all product columns
          },
        },
      },
    });

    return {
      queryTime: Date.now() - start,
      warning:
        `ANTI-PATTERN: Deep include without select. Fetched ${orders.length} orders with ALL columns from user, items, and products. ` +
        'Response payload is 10x larger than necessary.',
    };
  }

  /**
   * GOOD: Selects only required fields at every level of the include tree.
   */
  async getOrdersDeepFetchGood(): Promise<{ queryTime: number; info: string }> {
    const start = Date.now();
    const orders = await this.prisma.order.findMany({
      select: {
        id: true,
        status: true,
        totalPrice: true,
        user: {
          select: { id: true, name: true },
        },
        items: {
          select: {
            quantity: true,
            price: true,
            product: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    return {
      queryTime: Date.now() - start,
      info:
        `GOOD: Nested select. Fetched ${orders.length} orders with only required fields. ` +
        'Payload is minimal. Network and memory pressure reduced.',
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // BOTTLENECK 9: Sequential Await (Blocking I/O)
  // ─────────────────────────────────────────────────────────────────

  /**
   * BAD: Awaits independent async operations one after another.
   * Total time = sum of all individual times. With 3 queries at 20ms each = 60ms.
   */
  async getDashboardDataBad(): Promise<{ queryTime: number; breakdown: any; warning: string }> {
    const start = Date.now();

    // Each waits for the previous to finish — completely unnecessary
    const t1 = Date.now();
    const userCount = await this.prisma.user.count();
    const t1ms = Date.now() - t1;

    const t2 = Date.now();
    const postCount = await this.prisma.post.count();
    const t2ms = Date.now() - t2;

    const t3 = Date.now();
    const orderCount = await this.prisma.order.count();
    const t3ms = Date.now() - t3;

    const t4 = Date.now();
    const productCount = await this.prisma.product.count();
    const t4ms = Date.now() - t4;

    return {
      queryTime: Date.now() - start,
      breakdown: { userCount, postCount, orderCount, productCount, t1ms, t2ms, t3ms, t4ms },
      warning:
        'ANTI-PATTERN: 4 independent queries run sequentially. ' +
        `Total = ${t1ms}+${t2ms}+${t3ms}+${t4ms}ms. Use Promise.all to parallelize.`,
    };
  }

  /**
   * GOOD: Fires all independent queries concurrently with Promise.all.
   * Total time ≈ slowest individual query, not the sum.
   */
  async getDashboardDataGood(): Promise<{ queryTime: number; breakdown: any; info: string }> {
    const start = Date.now();

    // All 4 queries fire simultaneously — total time = max(individual times)
    const [userCount, postCount, orderCount, productCount] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.post.count(),
      this.prisma.order.count(),
      this.prisma.product.count(),
    ]);

    return {
      queryTime: Date.now() - start,
      breakdown: { userCount, postCount, orderCount, productCount },
      info:
        'GOOD: 4 concurrent queries via Promise.all. ' +
        'Total time ≈ slowest single query, not their sum.',
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // BOTTLENECK 10: Unindexed WHERE Clauses (Missing @@index in Schema)
  // ─────────────────────────────────────────────────────────────────

  /**
   * BAD: Filtering on a column with no database index forces a full table scan.
   * The `published` column on Post has no @@index — every query must read ALL rows.
   */
  async getPublishedPostsBad(): Promise<{ count: number; queryTime: number; warning: string }> {
    const start = Date.now();

    // `published` has no @@index — full table scan on every call
    const posts = await this.prisma.post.findMany({
      where: { published: true },
      select: { id: true, title: true },
    });

    return {
      count: posts.length,
      queryTime: Date.now() - start,
      warning:
        'ANTI-PATTERN: WHERE on unindexed column `published`. ' +
        'SQLite/Postgres must scan the entire Post table. ' +
        'At 1M rows this query takes seconds. Add @@index([published]) to the schema.',
    };
  }

  /**
   * GOOD: Demonstrates the fix — what the query plan looks like after adding @@index.
   * The index lets the DB jump directly to matching rows via a B-tree lookup.
   *
   * To apply the fix, uncomment in schema.prisma:
   *   @@index([published, createdAt])
   * then run: npx prisma migrate dev --name add-post-index
   */
  async getPublishedPostsGood(): Promise<{ count: number; queryTime: number; info: string }> {
    const start = Date.now();

    // Same query — but with @@index([published, createdAt]) in schema this becomes an index seek
    const posts = await this.prisma.post.findMany({
      where: { published: true },
      orderBy: { createdAt: 'desc' }, // covered by the composite index
      select: { id: true, title: true, createdAt: true },
    });

    return {
      count: posts.length,
      queryTime: Date.now() - start,
      info:
        'FIX: Add @@index([published, createdAt]) to Post model in schema.prisma. ' +
        'DB uses index seek instead of full table scan. ' +
        'Query time stays O(log n) regardless of table size.',
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // BOTTLENECK 11: Max Parameters (Massive createMany / IN clause)
  // ─────────────────────────────────────────────────────────────────

  /**
   * BAD: Passing thousands of records to createMany or a massive IN clause
   * can exceed the database's max parameter limit.
   * SQLite: 32,766 parameters. PostgreSQL: 65,535 parameters.
   * A createMany of 10,000 records with 5 columns = 50,000 parameters → ERROR.
   */
  async bulkInsertBad(count: number): Promise<{ queryTime: number; inserted: number; warning: string }> {
    const start = Date.now();

    const data = Array.from({ length: count }, (_, i) => ({
      name: `Bulk Tag ${i}`,
      // If count > ~6500 with this schema, SQLite will throw "too many SQL variables"
    }));

    try {
      // Single createMany with potentially thousands of params
      const result = await this.prisma.tag.createMany({
        data,
      });

      return {
        queryTime: Date.now() - start,
        inserted: result.count,
        warning:
          `ANTI-PATTERN: Single createMany with ${count} records. ` +
          'SQLite limit is 32,766 parameters (columns × rows). ' +
          'PostgreSQL limit is 65,535. Exceeding this throws a database error at runtime.',
      };
    } catch (err: any) {
      return {
        queryTime: Date.now() - start,
        inserted: 0,
        warning: `ANTI-PATTERN: createMany(${count}) failed — ${err.message}. Batch your inserts!`,
      };
    }
  }

  /**
   * GOOD: Chunk large datasets into safe batch sizes before inserting.
   * Each batch stays well within database parameter limits.
   */
  async bulkInsertGood(count: number): Promise<{ queryTime: number; inserted: number; info: string }> {
    const start = Date.now();
    const BATCH_SIZE = 500; // safe for all DBs: 500 rows × ~5 cols = 2,500 params per batch

    const data = Array.from({ length: count }, (_, i) => ({
      name: `Safe Tag ${Date.now()}-${i}`,
    }));

    let totalInserted = 0;
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const chunk = data.slice(i, i + BATCH_SIZE);
      const result = await this.prisma.tag.createMany({
        data: chunk,
      });
      totalInserted += result.count;
    }

    // Clean up the test tags
    await this.prisma.tag.deleteMany({ where: { name: { startsWith: 'Safe Tag' } } });

    return {
      queryTime: Date.now() - start,
      inserted: totalInserted,
      info:
        `GOOD: Batched createMany in chunks of ${BATCH_SIZE}. ` +
        `${Math.ceil(count / BATCH_SIZE)} batches fired. ` +
        'Never exceeds DB parameter limits. Works for any dataset size.',
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // BOTTLENECK 12: Engine Startup / Cold Start (Serverless)
  // ─────────────────────────────────────────────────────────────────

  /**
   * BAD: In serverless environments, each cold function invocation re-initializes
   * PrismaClient, which loads and starts the Rust query engine binary (~10–40MB).
   * This adds 500ms–2s of latency to the first request after idle.
   *
   * This endpoint simulates what happens when you instantiate PrismaClient
   * inside the handler (the serverless anti-pattern).
   */
  async coldStartBad(): Promise<{ initTime: number; queryTime: number; totalTime: number; warning: string }> {
    const totalStart = Date.now();

    // Simulate serverless handler: new client per invocation
    const initStart = Date.now();
    const client = new PrismaClient({
      adapter: new PrismaBetterSqlite3({
        url: `file:${path.join(__dirname, '../../prisma/dev.db')}`,
      }),
    });
    await client.$connect();
    const initTime = Date.now() - initStart;

    const queryStart = Date.now();
    await client.user.count();
    const queryTime = Date.now() - queryStart;

    await client.$disconnect();

    return {
      initTime,
      queryTime,
      totalTime: Date.now() - totalStart,
      warning:
        'ANTI-PATTERN: PrismaClient instantiated per invocation. ' +
        `Init+connect took ${initTime}ms. In true serverless (Lambda) with the Rust ` +
        'engine binary this is 500ms–2s on cold start. ' +
        'Solutions: Prisma Accelerate, singleton outside handler, or connection pooler.',
    };
  }

  /**
   * GOOD: The NestJS singleton PrismaService is initialized once at bootstrap.
   * Subsequent requests reuse the already-warm client — no startup penalty.
   */
  async coldStartGood(): Promise<{ queryTime: number; info: string }> {
    const start = Date.now();
    await this.prisma.user.count(); // reuses already-connected singleton

    return {
      queryTime: Date.now() - start,
      info:
        'GOOD: Singleton PrismaService already connected at app bootstrap. ' +
        'Zero init overhead on each request. ' +
        'For true serverless: use Prisma Accelerate (connection proxy) or instantiate ' +
        'PrismaClient outside the handler function in the module scope.',
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // BOTTLENECK 13: In-Memory Sorting (Missing orderBy in Prisma)
  // ─────────────────────────────────────────────────────────────────

  /**
   * BAD: Fetches all records unsorted, then sorts in JavaScript.
   * Sorting 100,000 objects in Node.js is slow and spikes heap memory.
   * The database's sort algorithms (using indexes) are orders of magnitude faster.
   */
  async getPostsSortedBad(): Promise<{ count: number; queryTime: number; sortTime: number; warning: string }> {
    const fetchStart = Date.now();

    // No orderBy — DB returns rows in undefined order
    const posts = await this.prisma.post.findMany({
      select: { id: true, title: true, views: true, createdAt: true },
    });

    const fetchTime = Date.now() - fetchStart;

    // Sorting happens in Node.js — all rows must be loaded into heap first
    const sortStart = Date.now();
    const sorted = [...posts].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const sortTime = Date.now() - sortStart;

    return {
      count: sorted.length,
      queryTime: fetchTime,
      sortTime,
      warning:
        `ANTI-PATTERN: Fetched ${posts.length} rows then sorted in JavaScript (${sortTime}ms). ` +
        'At 1M rows: ~800MB heap allocation + ~3,000ms sort. ' +
        'The database has a sorted index — use orderBy and let it sort.',
    };
  }

  /**
   * GOOD: Delegates sorting to the database with orderBy.
   * The DB uses an index (or efficient sort algorithm) — far cheaper than JS Array.sort.
   * Combined with pagination, only the needed page is ever transferred.
   */
  async getPostsSortedGood(): Promise<{ count: number; queryTime: number; info: string }> {
    const start = Date.now();

    const posts = await this.prisma.post.findMany({
      orderBy: { createdAt: 'desc' }, // DB sorts using index/filesort — no JS overhead
      take: 20,                        // pagination prevents full-table transfer
      select: { id: true, title: true, views: true, createdAt: true },
    });

    return {
      count: posts.length,
      queryTime: Date.now() - start,
      info:
        `GOOD: orderBy delegated to DB, paginated (take: 20). ` +
        'Zero JavaScript sort overhead. Works in O(log n) with an index. ' +
        'Never loads more rows than needed into Node.js heap.',
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // Seed helper — populate the database with sample data
  // ─────────────────────────────────────────────────────────────────

  async seed(): Promise<{ message: string }> {
    const existingCount = await this.prisma.user.count();
    if (existingCount > 0) {
      return { message: `Database already seeded with ${existingCount} users.` };
    }

    // Create tags
    const tags = await Promise.all([
      this.prisma.tag.create({ data: { name: 'nestjs' } }),
      this.prisma.tag.create({ data: { name: 'prisma' } }),
      this.prisma.tag.create({ data: { name: 'performance' } }),
    ]);

    // Create products
    const products = await this.prisma.$transaction([
      this.prisma.product.create({ data: { name: 'Widget A', price: 9.99, stock: 100 } }),
      this.prisma.product.create({ data: { name: 'Widget B', price: 24.99, stock: 50 } }),
      this.prisma.product.create({ data: { name: 'Widget C', price: 4.99, stock: 200 } }),
    ]);

    // Create users with posts and orders
    for (let i = 1; i <= 10; i++) {
      const user = await this.prisma.user.create({
        data: {
          email: `user${i}@example.com`,
          name: `User ${i}`,
          posts: {
            create: Array.from({ length: 3 }, (_, j) => ({
              title: `Post ${j + 1} by User ${i}`,
              content: `Content of post ${j + 1} by user ${i}. `.repeat(20),
              published: j % 2 === 0,
              tags: {
                connect: [{ id: tags[j % tags.length].id }],
              },
            })),
          },
          orders: {
            create: [
              {
                status: 'completed',
                totalPrice: products[0].price * 2,
                items: {
                  create: [
                    { productId: products[0].id, quantity: 2, price: products[0].price },
                  ],
                },
              },
            ],
          },
        },
      });
    }

    const userCount = await this.prisma.user.count();
    const postCount = await this.prisma.post.count();
    return { message: `Seeded ${userCount} users and ${postCount} posts.` };
  }
}
