import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';

import { Notification } from '../../entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { Submission, SubmissionStatus } from '../../entities/submission.entity';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  async create(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    // status will default to 1 if not provided
    let receiverId: string | undefined = undefined;
    if (createNotificationDto.submissionId) {
      // Get the submittedBy from submissions table where status is not DRAFT
      const submissionRepo = this.notificationRepository.manager.getRepository(Submission);
      const submission = await submissionRepo.findOne({
        where: {
          submissionId: createNotificationDto.submissionId,
          status: Not(SubmissionStatus.DRAFT),
        },
        select: ['submittedBy'],
      });
      if (submission) {
        receiverId = submission.submittedBy;
      }
    }
    const notification = this.notificationRepository.create({
      title: createNotificationDto.title,
      message: createNotificationDto.message,
      senderId: createNotificationDto.senderId,
      receiverId: receiverId,
      status: createNotificationDto.status ?? 1,
    });
    return this.notificationRepository.save(notification);
  }

  async statusChangeNotificationId(id: string): Promise<void> {
    await this.notificationRepository.update({ id }, { status: 0 });
  }
  
  async getActiveNotificationsWithUserNames(receiverId?: string): Promise<any[]> {
    const qb = this.notificationRepository
      .createQueryBuilder('notification')
      .leftJoin('users', 'sender', 'sender.id::text = notification.senderId')
      .leftJoin('users', 'receiver', 'receiver.id::text = notification.receiverId')
      .where('notification.status = :status', { status: 1 });
    if (receiverId) {
      qb.andWhere('notification.receiverId = :receiverId', { receiverId });
    }
    const notifications = await qb
      .select([
        'notification.id AS id',
        'notification.title AS title',
        'notification.message AS message',
        'notification.status AS status',
        'notification.createdAt AS "createdAt"',
        `CONCAT(sender.firstName, ' ', sender.lastName) AS "senderFullName"`,
        `CONCAT(receiver.firstName, ' ', receiver.lastName) AS "receiverFullName"`,
      ])
      .getRawMany();
    return notifications;
  }
}
