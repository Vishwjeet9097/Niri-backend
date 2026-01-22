import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  UpdateEvent,
} from 'typeorm';
import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { MinistrySubmissionIndicator } from '../../ministry/entities/ministry-submission-indicator.entity';
import { MinistryScoringService } from './ministry-scoring.service';
import { IndicatorDetail } from '../../ministry/entities/indicator-detail.entity';
import { ClsService } from 'nestjs-cls';

/**
 * TypeORM Subscriber for automatic ministry scoring when indicator status changes
 * 
 * This subscriber automatically triggers score calculation when:
 * - MinistrySubmissionIndicator status changes
 * 
 * Separate from MinistryScoringSubscriber to handle different entity types.
 */
@Injectable()
@EventSubscriber()
export class MinistryIndicatorScoringSubscriber implements EntitySubscriberInterface {
  private readonly logger = new Logger(MinistryIndicatorScoringSubscriber.name);
  private scoringService: MinistryScoringService | null = null;

  constructor(
    private dataSource: DataSource,
    private moduleRef: ModuleRef,
    private clsService: ClsService,
  ) {
    // Register this subscriber with TypeORM
    dataSource.subscribers.push(this);
  }

  /**
   * Listen to MinistrySubmissionIndicator entity
   */
  listenTo() {
    return MinistrySubmissionIndicator;
  }

  /**
   * After MinistrySubmissionIndicator is updated, trigger scoring if status changed
   * Use setTimeout to ensure the transaction is fully committed before calculating
   */
  async afterUpdate(event: UpdateEvent<MinistrySubmissionIndicator>) {
    if (event.entity && event.databaseEntity) {
      const oldStatus = event.databaseEntity.status;
      const newStatus = (event.entity as MinistrySubmissionIndicator).status;

      // Only trigger if status actually changed
      if (oldStatus !== newStatus) {
        // Delay to ensure transaction is committed and submission is fully saved
        setTimeout(() => {
          this.handleIndicatorStatusChange(
            event.entity as MinistrySubmissionIndicator, 
            oldStatus, 
            newStatus
          ).catch(error => {
            this.logger.error(`Error in delayed scoring after status change: ${error.message}`);
          });
        }, 1000); // 1 second delay to ensure transaction is committed
      }
    }
  }

  /**
   * Handle status changes in MinistrySubmissionIndicator
   */
  private async handleIndicatorStatusChange(
    indicator: MinistrySubmissionIndicator,
    oldStatus: string | null,
    newStatus: string | null
  ) {
    try {
      this.logger.log(
        `📊 Ministry submission indicator status changed: ${oldStatus} → ${newStatus} (indicatorId: ${indicator.indicatorId})`
      );

      // Get the scoring service lazily
      if (!this.scoringService) {
        this.scoringService = this.moduleRef.get(MinistryScoringService, { strict: false });
      }

      if (!this.scoringService) {
        this.logger.warn('⚠️ MinistryScoringService not available, skipping automatic scoring');
        return;
      }

      // Get indicator details
      const indicatorDetail = await this.dataSource.manager.findOne(
        IndicatorDetail,
        { where: { id: indicator.indicatorId } }
      );

      if (!indicatorDetail) {
        this.logger.warn(`⚠️ IndicatorDetail not found: ${indicator.indicatorId}`);
        return;
      }

      const indicatorCode = indicatorDetail.sNo;
      const category = this.getCategoryFromIndicatorCode(indicatorCode);

      // Transform data to formData structure
      const formData = await this.scoringService.transformMinistryDataToFormDataForIndicator(
        indicator.id,
        indicator.indicatorId
      );

      // Get user ID from context if available
      const auditContext = this.clsService.get('auditContext');
      const userId = auditContext?.userId || null;

      // Determine update reason based on status change
      let updateReason = 'INDICATOR_STATUS_CHANGED';
      if (newStatus === 'SUBMITTED_TO_MINISTRY') {
        updateReason = 'INDICATOR_SUBMITTED';
      } else if (newStatus === 'RESUBMITTED') {
        updateReason = 'INDICATOR_RESUBMITTED';
      } else if (newStatus === 'ACCEPTED_BY_MINISTRY' || newStatus === 'ACCEPTED_BY_MOSPI') {
        updateReason = 'INDICATOR_ACCEPTED';
      }

      // Trigger score calculation
      await this.scoringService.calculateIndicatorScore(
        indicator.submissionId,
        indicatorCode,
        category,
        formData,
        userId,
        updateReason,
        newStatus || null
      );

      this.logger.log(
        `✅ Automatic ministry scoring triggered for indicator ${indicatorCode} due to status change (submission: ${indicator.submissionId})`
      );
    } catch (error) {
      this.logger.error(
        `❌ Error in automatic ministry scoring for indicator ${indicator.id}: ${error.message}`,
        error.stack
      );
      // Don't throw - we don't want to break the main transaction
    }
  }

  /**
   * Get category from indicator code
   */
  private getCategoryFromIndicatorCode(indicatorCode: string): string {
    if (indicatorCode.startsWith('1.')) {
      return 'infraFinancing';
    } else if (indicatorCode.startsWith('2.')) {
      return 'infraDevelopment';
    } else if (indicatorCode.startsWith('3.')) {
      return 'pppDevelopment';
    } else if (indicatorCode.startsWith('4.')) {
      return 'infraEnablers';
    }
    return 'unknown';
  }
}

