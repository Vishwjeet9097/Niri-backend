import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { Indicator } from "../../entities/indicator.entity";
import { UserIndicatorScope } from "../../entities/user-indicator-scope.entity";
import { User } from "../../entities/user.entity";

@Injectable()
export class IndicatorService {
  constructor(
    @InjectRepository(Indicator)
    private indicatorRepository: Repository<Indicator>,
    @InjectRepository(UserIndicatorScope)
    private userIndicatorScopeRepository: Repository<UserIndicatorScope>,
    @InjectRepository(User)
    private userRepository: Repository<User>
  ) {}

  async findAll(): Promise<Indicator[]> {
    return this.indicatorRepository.find({
      where: { isActive: true },
      order: { code: "ASC" },
    });
  }

  async findOne(id: string): Promise<Indicator> {
    return this.indicatorRepository.findOne({
      where: { id },
    });
  }

  async findByCode(code: string): Promise<Indicator> {
    return this.indicatorRepository.findOne({
      where: { code },
    });
  }

  async findBySection(sectionId: string): Promise<Indicator[]> {
    return this.indicatorRepository.find({
      where: { sectionId, isActive: true },
      order: { code: "ASC" },
    });
  }

  async findByCategory(category: string): Promise<Indicator[]> {
    return this.indicatorRepository.find({
      where: { category, isActive: true },
      order: { code: "ASC" },
    });
  }

  async search(
    query: string,
    category?: string,
    isActive?: boolean
  ): Promise<Indicator[]> {
    const queryBuilder =
      this.indicatorRepository.createQueryBuilder("indicator");

    if (query) {
      queryBuilder.where(
        "(indicator.name ILIKE :query OR indicator.code ILIKE :query)",
        { query: `%${query}%` }
      );
    }

    if (category) {
      queryBuilder.andWhere("indicator.category = :category", { category });
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere("indicator.isActive = :isActive", { isActive });
    }

    return queryBuilder.orderBy("indicator.code", "ASC").getMany();
  }

  async getUserIndicators(userId: string): Promise<Indicator[]> {
    const userIndicatorScopes = await this.userIndicatorScopeRepository.find({
      where: { userId },
      relations: ["indicator"],
    });

    return userIndicatorScopes
      .map((scope) => scope.indicator)
      .filter((indicator) => indicator.isActive);
  }

  async getUserIndicatorScopes(userId: string) {
    const userIndicatorScopes = await this.userIndicatorScopeRepository
      .createQueryBuilder("scope")
      .leftJoinAndSelect("scope.indicator", "indicator")
      .where("scope.userId = :userId", { userId })
      .getMany();

    return userIndicatorScopes.map((scope) => ({
      id: scope.id,
      userId: scope.userId,
      indicatorId: scope.indicatorId,
      indicator: {
        id: scope.indicator.id,
        code: scope.indicator.code,
        name: scope.indicator.name,
        category: scope.indicator.category,
        maxScore: scope.indicator.maxScore,
        isActive: scope.indicator.isActive,
      },
      createdAt: scope.createdAt,
    }));
  }

  async assignIndicatorsToUser(
    userId: string,
    indicatorCodes: string[]
  ): Promise<{ message: string; assigned: string[] }> {
    // Verify user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error("User not found");
    }

    // Get indicators by codes
    const indicators = await this.indicatorRepository.find({
      where: { code: In(indicatorCodes) },
    });

    if (indicators.length !== indicatorCodes.length) {
      const foundCodes = indicators.map((ind) => ind.code);
      const missingCodes = indicatorCodes.filter(
        (code) => !foundCodes.includes(code)
      );
      throw new Error(`Indicators not found: ${missingCodes.join(", ")}`);
    }

    // Remove existing assignments for this user
    await this.userIndicatorScopeRepository.delete({ userId });

    // Create new assignments
    const assignments = indicators.map((indicator) => ({
      userId,
      indicatorId: indicator.id,
    }));

    await this.userIndicatorScopeRepository.save(assignments);

    return {
      message: "Indicators assigned successfully",
      assigned: indicatorCodes,
    };
  }

  async removeIndicatorsFromUser(
    userId: string,
    indicatorCodes: string[]
  ): Promise<{ message: string; removed: string[] }> {
    // Get indicators by codes
    const indicators = await this.indicatorRepository.find({
      where: { code: In(indicatorCodes) },
    });

    if (indicators.length === 0) {
      return {
        message: "No indicators found to remove",
        removed: [],
      };
    }

    const indicatorIds = indicators.map((ind) => ind.id);

    // Remove assignments
    await this.userIndicatorScopeRepository.delete({
      userId,
      indicatorId: In(indicatorIds),
    });

    return {
      message: "Indicators removed successfully",
      removed: indicatorCodes,
    };
  }

  async getUsersByIndicator(indicatorCode: string): Promise<User[]> {
    const indicator = await this.findByCode(indicatorCode);
    if (!indicator) {
      throw new Error("Indicator not found");
    }

    const userIndicatorScopes = await this.userIndicatorScopeRepository.find({
      where: { indicatorId: indicator.id },
      relations: ["user"],
    });

    return userIndicatorScopes.map((scope) => scope.user);
  }

  async getIndicatorStatistics(): Promise<any> {
    const totalIndicators = await this.indicatorRepository.count();
    const activeIndicators = await this.indicatorRepository.count({
      where: { isActive: true },
    });
    const totalAssignments = await this.userIndicatorScopeRepository.count();

    const categoryStats = await this.indicatorRepository
      .createQueryBuilder("indicator")
      .select("indicator.category", "category")
      .addSelect("COUNT(*)", "count")
      .where("indicator.isActive = :isActive", { isActive: true })
      .groupBy("indicator.category")
      .getRawMany();

    return {
      totalIndicators,
      activeIndicators,
      inactiveIndicators: totalIndicators - activeIndicators,
      totalAssignments,
      categoryStats,
    };
  }

  async getUsageReport(): Promise<any> {
    const usageStats = await this.userIndicatorScopeRepository
      .createQueryBuilder("scope")
      .leftJoin("scope.indicator", "indicator")
      .leftJoin("scope.user", "user")
      .select("indicator.code", "indicatorCode")
      .addSelect("indicator.name", "indicatorName")
      .addSelect("indicator.category", "category")
      .addSelect("COUNT(scope.userId)", "userCount")
      .groupBy(
        "indicator.id, indicator.code, indicator.name, indicator.category"
      )
      .orderBy("userCount", "DESC")
      .getRawMany();

    return usageStats;
  }
}
