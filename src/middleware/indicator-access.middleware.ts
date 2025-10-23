import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserRole } from "../entities/user.entity";
import { Indicator } from "../entities/indicator.entity";
import { UserIndicatorScope } from "../entities/user-indicator-scope.entity";

@Injectable()
export class IndicatorAccessMiddleware implements CanActivate {
  private readonly logger = new Logger(IndicatorAccessMiddleware.name);

  constructor(
    @InjectRepository(Indicator)
    private indicatorRepository: Repository<Indicator>,
    @InjectRepository(UserIndicatorScope)
    private userIndicatorScopeRepository: Repository<UserIndicatorScope>
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const req = request;
    try {
      // Only apply to NODAL_OFFICER role
      if (req.user?.role !== UserRole.NODAL_OFFICER) {
        return true;
      }

      // Check if formData exists in request body
      if (!req.body?.formData || typeof req.body.formData !== "object") {
        return true;
      }

      this.logger.log(`Checking indicator access for user: ${req.user.id}`);
      this.logger.log(
        `Form data keys: ${Object.keys(req.body.formData).join(", ")}`
      );

      // Extract indicator codes from formData keys
      const formDataKeys = Object.keys(req.body.formData);

      // Filter out non-indicator keys (like general form fields)
      const indicatorCodes = formDataKeys.filter((key) => {
        // Check if key matches indicator pattern (e.g., "1.1", "2.3", "3.1.1")
        const indicatorPattern = /^\d+(\.\d+)*$/;
        return indicatorPattern.test(key);
      });

      if (indicatorCodes.length === 0) {
        this.logger.log("No indicator codes found in form data, proceeding");
        return true;
      }

      this.logger.log(`Found indicator codes: ${indicatorCodes.join(", ")}`);

      // Get user's assigned indicator codes
      const userIndicatorScopes = await this.userIndicatorScopeRepository
        .createQueryBuilder("uis")
        .leftJoinAndSelect("uis.indicator", "indicator")
        .where("uis.userId = :userId", { userId: req.user.id })
        .andWhere("indicator.isActive = :isActive", { isActive: true })
        .getMany();

      const assignedIndicatorCodes = userIndicatorScopes.map(
        (scope) => scope.indicator.code
      );

      this.logger.log(
        `User assigned indicator codes: ${assignedIndicatorCodes.join(", ")}`
      );

      // Check if user has access to all submitted indicators
      const unauthorizedIndicators = indicatorCodes.filter(
        (code) => !assignedIndicatorCodes.includes(code)
      );

      if (unauthorizedIndicators.length > 0) {
        this.logger.error(
          `Unauthorized indicators: ${unauthorizedIndicators.join(", ")}`
        );
        throw new ForbiddenException(
          `Access denied. You don't have permission to modify indicators: ${unauthorizedIndicators.join(", ")}`
        );
      }

      this.logger.log("All indicator access checks passed");
      return true;
    } catch (error) {
      this.logger.error(`Indicator access check failed: ${error.message}`);
      throw error;
    }
  }
}
