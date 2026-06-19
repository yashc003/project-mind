import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getUsers() {
    return [{ name: 'Test' }];
  }
  
  createUser() {
    return { success: true };
  }
}
