import { Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller('users')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getUsers() {
    return this.appService.getUsers();
  }

  @Post()
  createUser() {
    return this.appService.createUser();
  }
}
