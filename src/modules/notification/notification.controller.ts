
import { Body, Controller, Post, Patch, Param, UseGuards, ParseIntPipe, Get, Query } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { Notification } from '../../entities/notification.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get(':receiverId')
  @UseGuards(JwtAuthGuard)
  async getActiveNotifications(@Param('receiverId') receiverId: string): Promise<any[]> {
    return this.notificationService.getActiveNotificationsWithUserNames(receiverId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async createNotification(
    @Body() createNotificationDto: CreateNotificationDto,
  ): Promise<Notification> {
    return this.notificationService.create(createNotificationDto);
  }

  @Patch('status/:id')
  @UseGuards(JwtAuthGuard)
  async statusChangeNotification(@Param('id') id: string): Promise<{ success: boolean; message: string }> {
    await this.notificationService.statusChangeNotificationId(id);
    return { success: true, message: `Notification read it` };
  }
}