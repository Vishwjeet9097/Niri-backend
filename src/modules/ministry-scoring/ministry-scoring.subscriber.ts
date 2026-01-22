import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';
import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { MinistrySubmissionData } from '../../ministry/entities/ministry-submission-data.entity';
import { MinistrySubmissionIndicator } from '../../ministry/entities/ministry-submission-indicator.entity';
import { MinistryScoringService } from './ministry-scoring.service';
import { IndicatorDetail } from '../../ministry/entities/indicator-detail.entity';
import { ClsService } from 'nestjs-cls';

/**
 * TypeORM Subscriber for automatic ministry scoring
 * 
 * This subscriber automatically triggers score calculation when:
 * - MinistrySubmissionData is inserted or updated
 * - MinistrySubmissionIndicator status changes
 * 
 * Uses debouncing to prevent duplicate calculations when multiple updates happen quickly.
 */
@Injectable()
@EventSubscriber()
export class MinistryScoringSubscriber implements EntitySubscriberInterface {
  private readonly logger = new Logger(MinistryScoringSubscriber.name);
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
   * Listen to MinistrySubmissionData and MinistrySubmissionIndicator entities
   */
  listenTo() {
    return MinistrySubmissionData;
  }

  /**
   * After MinistrySubmissionData is inserted, trigger scoring
   * Use setTimeout to ensure the transaction is fully committed before calculating
   */
  async afterInsert(event: InsertEvent<MinistrySubmissionData>) {
    // Delay to ensure transaction is committed and submission is fully saved
    setTimeout(() => {
      this.handleDataChange(event.entity, 'INSERT').catch(error => {
        this.logger.error(`Error in delayed scoring after insert: ${error.message}`);
      });
    }, 1000); // 1 second delay to ensure transaction is committed
  }

  /**
   * After MinistrySubmissionData is updated, trigger scoring
   * Use setTimeout to ensure the transaction is fully committed before calculating
   */
  async afterUpdate(event: UpdateEvent<MinistrySubmissionData>) {
    if (event.entity) {
      // Delay to ensure transaction is committed and submission is fully saved
      setTimeout(() => {
        this.handleDataChange(event.entity as MinistrySubmissionData, 'UPDATE').catch(error => {
          this.logger.error(`Error in delayed scoring after update: ${error.message}`);
        });
      }, 1000); // 1 second delay to ensure transaction is committed
    }
  }

  /**
   * Handle data changes in MinistrySubmissionData
   */
  private async handleDataChange(
    data: MinistrySubmissionData,
    action: 'INSERT' | 'UPDATE'
  ) {
    try {
      this.logger.log(
        `📊 Ministry submission data ${action.toLowerCase()}: submissionIndicatorId=${data.submissionIndicatorId}, inputFieldId=${data.inputFieldId}`
      );

      // Get the scoring service lazily (to avoid circular dependencies)
      if (!this.scoringService) {
        this.scoringService = this.moduleRef.get(MinistryScoringService, { strict: false });
      }

      if (!this.scoringService) {
        this.logger.warn('⚠️ MinistryScoringService not available, skipping automatic scoring');
        return;
      }

      // Get the submission indicator to find submissionId and indicatorId
      const submissionIndicator = await this.dataSource.manager.findOne(
        MinistrySubmissionIndicator,
        { where: { id: data.submissionIndicatorId } }
      );

      if (!submissionIndicator) {
        this.logger.warn(
          `⚠️ MinistrySubmissionIndicator not found: ${data.submissionIndicatorId}`
        );
        return;
      }

      // Get indicator details to find sNo and category
      const indicatorDetail = await this.dataSource.manager.findOne(
        IndicatorDetail,
        { where: { id: submissionIndicator.indicatorId } }
      );

      if (!indicatorDetail) {
        this.logger.warn(`⚠️ IndicatorDetail not found: ${submissionIndicator.indicatorId}`);
        return;
      }

      const indicatorCode = indicatorDetail.sNo;
      const category = this.getCategoryFromIndicatorCode(indicatorCode);

      // Transform data to formData structure
      const formData = await this.scoringService.transformMinistryDataToFormDataForIndicator(
        data.submissionIndicatorId,
        submissionIndicator.indicatorId
      );

      // Get user ID from context if available
      const auditContext = this.clsService.get('auditContext');
      const userId = auditContext?.userId || null;

      // Determine update reason based on action
      const updateReason = action === 'INSERT' ? 'INDICATOR_DATA_INSERTED' : 'INDICATOR_DATA_UPDATED';

      // Trigger score calculation (with debouncing built into the service)
      await this.scoringService.calculateIndicatorScore(
        submissionIndicator.submissionId,
        indicatorCode,
        category,
        formData,
        userId,
        updateReason,
        submissionIndicator.status || null
      );

      this.logger.log(
        `✅ Automatic ministry scoring triggered for indicator ${indicatorCode} (submission: ${submissionIndicator.submissionId})`
      );
    } catch (error) {
      this.logger.error(
        `❌ Error in automatic ministry scoring for data ${data.id}: ${error.message}`,
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

