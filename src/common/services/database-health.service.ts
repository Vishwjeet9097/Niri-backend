import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';

@Injectable()
export class DatabaseHealthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async checkDatabaseHealth(): Promise<{
    isConnected: boolean;
    hasUsersTable: boolean;
    userCount: number;
    error?: string;
  }> {
    try {
      // Check if database is connected
      await this.userRepository.query('SELECT 1');
      
      // Check if users table exists and get count
      const result = await this.userRepository.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_name = 'users' AND table_schema = 'public'
      `);
      
      const hasUsersTable = result[0]?.count > 0;
      
      let userCount = 0;
      if (hasUsersTable) {
        const userCountResult = await this.userRepository.query('SELECT COUNT(*) as count FROM users');
        userCount = parseInt(userCountResult[0]?.count || '0');
      }

      return {
        isConnected: true,
        hasUsersTable,
        userCount,
      };
    } catch (error) {
      return {
        isConnected: false,
        hasUsersTable: false,
        userCount: 0,
        error: error.message,
      };
    }
  }

  async checkUsersTableExists(): Promise<boolean> {
    try {
      const result = await this.userRepository.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'users' AND table_schema = 'public'
        )
      `);
      return result[0]?.exists || false;
    } catch (error) {
      return false;
    }
  }
}
