import { Controller, Post, Body, Get, UseGuards } from "@nestjs/common";
import { ValidationService } from "./validation.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@Controller("validation")
@UseGuards(JwtAuthGuard)
export class ValidationController {
  constructor(private readonly validationService: ValidationService) {}

  /**
   * Calculate % Allocation to GSDP
   * POST /validation/calculate-allocation-to-gsdp
   */
  @Post("calculate-allocation-to-gsdp")
  calculateAllocationToGSDP(
    @Body() body: { capitalAllocation: number; gsdp: number }
  ) {
    const { capitalAllocation, gsdp } = body;

    const percentage = this.validationService.calculateAllocationToGSDP(
      capitalAllocation,
      gsdp
    );

    return {
      status: true,
      data: {
        capitalAllocation,
        gsdp,
        allocationToGSDP: percentage,
        formatted: {
          capitalAllocation:
            this.validationService.formatNumber(capitalAllocation),
          gsdp: this.validationService.formatNumber(gsdp),
          allocationToGSDP: `${percentage}%`,
        },
      },
      message: "Allocation to GSDP calculated successfully",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Calculate % Capex Utilization
   * POST /validation/calculate-capex-utilization
   */
  @Post("calculate-capex-utilization")
  calculateCapexUtilization(
    @Body() body: { actualCapex: number; stateCapexUtilisation: number }
  ) {
    const { actualCapex, stateCapexUtilisation } = body;

    const percentage = this.validationService.calculateCapexUtilization(
      actualCapex,
      stateCapexUtilisation
    );

    return {
      status: true,
      data: {
        actualCapex,
        stateCapexUtilisation,
        capexUtilization: percentage,
        formatted: {
          actualCapex: this.validationService.formatNumber(actualCapex),
          stateCapexUtilisation: this.validationService.formatNumber(
            stateCapexUtilisation
          ),
          capexUtilization: `${percentage}%`,
        },
      },
      message: "Capex utilization calculated successfully",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Calculate % of Credit Rated ULBs
   * POST /validation/calculate-credit-rated-ulbs
   */
  @Post("calculate-credit-rated-ulbs")
  calculateCreditRatedULBs(
    @Body() body: { creditRatedULBs: number; totalULBs: number }
  ) {
    const { creditRatedULBs, totalULBs } = body;

    const percentage = this.validationService.calculateCreditRatedULBs(
      creditRatedULBs,
      totalULBs
    );

    return {
      status: true,
      data: {
        creditRatedULBs,
        totalULBs,
        creditRatedULBsPercentage: percentage,
        formatted: {
          creditRatedULBs: this.validationService.formatNumber(creditRatedULBs),
          totalULBs: this.validationService.formatNumber(totalULBs),
          creditRatedULBsPercentage: `${percentage}%`,
        },
      },
      message: "Credit rated ULBs percentage calculated successfully",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Calculate % of ULBs Issuing Bonds
   * POST /validation/calculate-ulbs-issuing-bonds
   */
  @Post("calculate-ulbs-issuing-bonds")
  calculateULBsIssuingBonds(
    @Body() body: { ulbsApprovedByMoSPI: number; totalULBsEntered: number }
  ) {
    const { ulbsApprovedByMoSPI, totalULBsEntered } = body;

    const percentage = this.validationService.calculateULBsIssuingBonds(
      ulbsApprovedByMoSPI,
      totalULBsEntered
    );

    return {
      status: true,
      data: {
        ulbsApprovedByMoSPI,
        totalULBsEntered,
        ulbsIssuingBondsPercentage: percentage,
        formatted: {
          ulbsApprovedByMoSPI:
            this.validationService.formatNumber(ulbsApprovedByMoSPI),
          totalULBsEntered:
            this.validationService.formatNumber(totalULBsEntered),
          ulbsIssuingBondsPercentage: `${percentage}%`,
        },
      },
      message: "ULBs issuing bonds percentage calculated successfully",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Validate and calculate all form data
   * POST /validation/calculate-all
   */
  @Post("calculate-all")
  calculateAll(@Body() formData: Record<string, any>) {
    const validatedData =
      this.validationService.validateAndCalculateFormData(formData);

    return {
      status: true,
      data: validatedData,
      message: "All calculations completed successfully",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get field validation rules for frontend
   * GET /validation/rules
   */
  @Get("rules")
  getValidationRules() {
    const rules = this.validationService.getFieldValidationRules();

    return {
      status: true,
      data: rules,
      message: "Validation rules retrieved successfully",
      timestamp: new Date().toISOString(),
    };
  }
}
