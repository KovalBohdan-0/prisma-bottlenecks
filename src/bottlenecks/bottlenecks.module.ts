import { Module } from '@nestjs/common';
import { BottlenecksController } from './bottlenecks.controller';
import { BottlenecksService } from './bottlenecks.service';

@Module({
  controllers: [BottlenecksController],
  providers: [BottlenecksService],
})
export class BottlenecksModule {}
