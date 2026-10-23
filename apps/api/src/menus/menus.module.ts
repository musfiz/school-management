import { Module } from '@nestjs/common';
import { MenusService } from './menus.service';
import { MenusController } from './menus.controller';
import { SystemMenusController } from './system-menus.controller';

@Module({
  controllers: [MenusController, SystemMenusController],
  providers: [MenusService],
})
export class MenusModule {}
