import { Injectable } from "@nestjs/common";

@Injectable()
export class ValidationService {
  /**
   * Calculate % Allocation to GSDP based on Capital Allocation and GSDP
   * Formula: (Capital Allocation for FY / GSDP for FY) * 100
   * Returns integer if result is whole number, otherwise rounds to 2 decimal places
   */
  calculateAllocationToGSDP(capitalAllocation: number, gsdp: number): number {
    if (!capitalAllocation || !gsdp || gsdp === 0) {
      return 0;
    }

    const percentage = (capitalAllocation / gsdp) * 100;
    const rounded = Math.round(percentage * 100) / 100;
    // If the result is a whole number, return as integer, otherwise return with decimals (up to 2)
    return rounded % 1 === 0 ? Math.round(rounded) : rounded;
  }

  /**
   * Calculate % Capex Utilization based on Actual Capex and State Capex Utilisation
   * Formula: (Actual Capex / State Capex Utilisation) * 100
   * Returns integer if result is whole number, otherwise rounds to 2 decimal places
   */
  calculateCapexUtilization(
    actualCapex: number,
    stateCapexUtilisation: number
  ): number {
    if (!actualCapex || !stateCapexUtilisation || stateCapexUtilisation === 0) {
      return 0;
    }

    const percentage = (actualCapex / stateCapexUtilisation) * 100;
    const rounded = Math.round(percentage * 100) / 100;
    // If the result is a whole number, return as integer, otherwise return with decimals (up to 2)
    return rounded % 1 === 0 ? Math.round(rounded) : rounded;
  }

  /**
   * Calculate % of Credit Rated ULBs
   * Formula: (Credit Rated ULBs / Total ULBs) * 100
   * Returns integer if result is whole number, otherwise rounds to 2 decimal places
   */
  calculateCreditRatedULBs(creditRatedULBs: number, totalULBs: number): number {
    if (!creditRatedULBs || !totalULBs || totalULBs === 0) {
      return 0;
    }

    const percentage = (creditRatedULBs / totalULBs) * 100;
    const rounded = Math.round(percentage * 100) / 100;
    // If the result is a whole number, return as integer, otherwise return with decimals (up to 2)
    return rounded % 1 === 0 ? Math.round(rounded) : rounded;
  }

  /**
   * Calculate % of ULBs Issuing Bonds
   * Formula: (ULBs Approved by MoSPI / Total ULBs Entered) * 100
   * Returns integer if result is whole number, otherwise rounds to 2 decimal places
   */
  calculateULBsIssuingBonds(
    ulbsApprovedByMoSPI: number,
    totalULBsEntered: number
  ): number {
    if (!ulbsApprovedByMoSPI || !totalULBsEntered || totalULBsEntered === 0) {
      return 0;
    }

    const percentage = (ulbsApprovedByMoSPI / totalULBsEntered) * 100;
    const rounded = Math.round(percentage * 100) / 100;
    // If the result is a whole number, return as integer, otherwise return with decimals (up to 2)
    return rounded % 1 === 0 ? Math.round(rounded) : rounded;
  }

  /**
   * Validate and calculate all form field percentages
   */
  validateAndCalculateFormData(
    formData: Record<string, any>
  ): Record<string, any> {
    const validatedData = { ...formData };

    // 1.1 % Allocation to GSDP calculation
    if (formData.capitalAllocationForFY && formData.gsdpForFY) {
      validatedData.allocationToGSDP = this.calculateAllocationToGSDP(
        formData.capitalAllocationForFY,
        formData.gsdpForFY
      );
    }

    // 1.2 % Capex Utilization calculation
    if (formData.stateCapexUtilisation && formData.actualCapex) {
      validatedData.capexUtilization = this.calculateCapexUtilization(
        formData.actualCapex,
        formData.stateCapexUtilisation
      );
    }

    // 1.3 % of Credit Rated ULBs calculation
    if (formData.creditRatedULBs && formData.totalULBs) {
      validatedData.creditRatedULBsPercentage = this.calculateCreditRatedULBs(
        formData.creditRatedULBs,
        formData.totalULBs
      );
    }

    // 1.4 % of ULBs Issuing Bonds calculation
    if (formData.ulbsApprovedByMoSPI && formData.totalULBsEntered) {
      validatedData.ulbsIssuingBondsPercentage = this.calculateULBsIssuingBonds(
        formData.ulbsApprovedByMoSPI,
        formData.totalULBsEntered
      );
    }

    return validatedData;
  }

  /**
   * Get field validation rules for frontend
   */
  getFieldValidationRules(): Record<string, any> {
    return {
      // 1.1 % Allocation to GSDP - Auto-calculated field
      allocationToGSDP: {
        type: "calculated",
        formula: "(Capital Allocation for FY / GSDP for FY) * 100",
        disabled: true,
        dependsOn: ["capitalAllocationForFY", "gsdpForFY"],
      },

      // 1.2 % Capex Utilization - Auto-calculated field
      capexUtilization: {
        type: "calculated",
        formula: "(Actual Capex / State Capex Utilisation) * 100",
        disabled: true,
        dependsOn: ["actualCapex", "stateCapexUtilisation"],
      },

      // 1.3 % of Credit Rated ULBs - Auto-calculated field
      creditRatedULBsPercentage: {
        type: "calculated",
        formula: "(Credit Rated ULBs / Total ULBs) * 100",
        disabled: true,
        dependsOn: ["creditRatedULBs", "totalULBs"],
      },

      // 1.4 % of ULBs Issuing Bonds - Auto-calculated field
      ulbsIssuingBondsPercentage: {
        type: "calculated",
        formula: "(ULBs Approved by MoSPI / Total ULBs Entered) * 100",
        disabled: true,
        dependsOn: ["ulbsApprovedByMoSPI", "totalULBsEntered"],
      },
    };
  }

  /**
   * Format number for display (add commas for thousands)
   */
  formatNumber(value: number): string {
    if (!value || isNaN(value)) return "0";
    return value.toLocaleString("en-IN");
  }

  /**
   * Parse number from formatted string
   */
  parseNumber(value: string): number {
    if (!value) return 0;
    // Remove commas and convert to number
    const cleanValue = value.replace(/,/g, "");
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
  }
}
