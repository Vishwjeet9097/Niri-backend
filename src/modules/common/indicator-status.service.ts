import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { Submission } from "../../entities/submission.entity";
import { Indicator } from "../../entities/indicator.entity";
import { UserRole } from "../../entities/user.entity";

@Injectable()
export class IndicatorStatusService {
  constructor(
    @InjectRepository(Submission)
    private submissionRepository: Repository<Submission>,
    @InjectRepository(Indicator)
    private indicatorRepository: Repository<Indicator>
  ) {}

  /**
   * Returns a set of accepted indicator codes for a given stateUt, deduped by code.
   * Only considers the latest submission by STATE_APPROVER or NODAL_OFFICER.
   */
  async getAcceptedIndicatorCodesForState(stateUt: string): Promise<Set<string>> {
    const APPROVED = new Set(["APPROVED", "ACCEPTED"]);
    const allActiveIndicators = await this.indicatorRepository.find({
      where: { isActive: true },
      order: { code: "ASC" },
    });
    const validCodes = new Set(allActiveIndicators.map((i) => i.code));

    const latestSubmission = await this.submissionRepository.findOne({
      where: {
        stateUt,
        currentOwnerRole: In([UserRole.STATE_APPROVER, UserRole.NODAL_OFFICER])
      },
      order: {
        createdAt: "DESC",
        id: "DESC"
      },
    });

    const acceptedCodes = new Set<string>();
    if (latestSubmission && latestSubmission.formData) {
      const formData: any = latestSubmission.formData;
      const normalizeCode = (parentKey: string, sectionKey: string): string | null => {
        if (!sectionKey) return null;
        const m = sectionKey.match(/section(\d+)_(\d+)/i);
        if (m) return `${m[1]}.${m[2]}`;
        if (/^\d+(\.\d+)*$/.test(sectionKey)) return sectionKey;
        return null;
      };
      Object.entries(formData).forEach(([parentKey, parentData]: [string, any]) => {
        if (typeof parentData !== "object" || parentData === null) return;
        Object.entries(parentData).forEach(([sectionKey, data]: [string, any]) => {
          const status = String(data?.status ?? "").toUpperCase();
          const mospiStatus = String(data?.mospi_status ?? "").toUpperCase();
          if (APPROVED.has(mospiStatus) || APPROVED.has(status)) {
            const code = normalizeCode(parentKey, sectionKey);
            if (code && validCodes.has(code)) {
              acceptedCodes.add(code);
            }
          }
        });
      });
    }
    return acceptedCodes;
  }

    async getMospiSubmissionStatusByState(stateUt: string): Promise<{
      submittedToMoSPI: Set<string>,
      returnedFromMoSPI: Set<string>,
      approvedByMoSPI: Set<string>
    }> {
      const allActiveIndicators = await this.indicatorRepository.find({
        where: { isActive: true },
        order: { code: "ASC" },
      });
      const validCodes = new Set(allActiveIndicators.map((i) => i.code));

      const latestSubmission = await this.submissionRepository.findOne({
        where: {
          stateUt,
          currentOwnerRole: In([UserRole.STATE_APPROVER])
        },
        order: {
          createdAt: "DESC", 
          id: "DESC"
        },
      });

      const submittedToMoSPI = new Set<string>();
      const returnedFromMoSPI = new Set<string>();
      const approvedByMoSPI = new Set<string>();

      if (latestSubmission && latestSubmission.formData) {
        const formData: any = latestSubmission.formData;
        const normalizeCode = (parentKey: string, sectionKey: string): string | null => {
          if (!sectionKey) return null;
          const m = sectionKey.match(/section(\d+)_(\d+)/i);
          if (m) return `${m[1]}.${m[2]}`;
          if (/^\d+(\.\d+)*$/.test(sectionKey)) return sectionKey;
          return null;
        };
        Object.entries(formData).forEach(([parentKey, parentData]: [string, any]) => {
          if (typeof parentData !== "object" || parentData === null) return;
          Object.entries(parentData).forEach(([sectionKey, data]: [string, any]) => {
            const status = String(data?.status ?? "").toUpperCase();
            const mospiStatus = String(data?.mospi_status ?? "").toUpperCase();
            const code = normalizeCode(parentKey, sectionKey);
            if (code && validCodes.has(code)) {
              if (mospiStatus === "REVERTED" || mospiStatus === "RETURNED_FROM_MOSPI") {
                returnedFromMoSPI.add(code);
              }
              if (mospiStatus === "ACCEPTED") { 
                approvedByMoSPI.add(code);
              }
              if (status === "SUBMITTED_TO_STATE") { 
                submittedToMoSPI.add(code);
              } 
            }
          });
        });
      }
      // Use NestJS Logger for counts
       
      return { submittedToMoSPI, returnedFromMoSPI, approvedByMoSPI };
    }
} 
