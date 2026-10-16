import { Module } from '@nestjs/common';
import { GoverningBodyService } from './governing-body.service';
import { GoverningBodyController } from './governing-body.controller';

@Module({
  controllers: [GoverningBodyController],
  providers: [GoverningBodyService],
})
export class GoverningBodyModule {}
