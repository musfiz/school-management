import { Controller, Get, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { AppService } from './app.service';
import { DatabaseService } from './database/database.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly databaseService: DatabaseService,
  ) {}

  @Get()
  @Public()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @Public()
  getHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Post('migrate')
  @Public()
  @HttpCode(HttpStatus.OK)
  async runMigrations() {
    return this.databaseService.runMigrations();
  }

  @Post('migrate/revert')
  @Public()
  @HttpCode(HttpStatus.OK)
  async revertMigration() {
    return this.databaseService.revertLastMigration();
  }
}
