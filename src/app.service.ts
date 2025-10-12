import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Welcome to NIRI Backend API - National Infrastructure Readiness Index';
  }
}
