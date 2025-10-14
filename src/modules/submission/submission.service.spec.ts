import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";

import { SubmissionService } from "./submission.service";
import { Submission, SubmissionStatus } from "../../entities/submission.entity";
import { UserRole } from "../../entities/user.entity";
import { FinalScore } from "../../entities/final-score.entity";
import { ScoringService } from "../scoring/scoring.service";
import {
  CreateSubmissionDto,
  ForwardToMoSPIDto,
  StateRejectDto,
  FinalRejectDto,
} from "./dto/submission.dto";

describe("SubmissionService", () => {
  let service: SubmissionService;
  let submissionRepository: any;
  let finalScoreRepository: any;
  let dataSource: any;
  let scoringService: ScoringService;

  const mockSubmissionRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockFinalScoreRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn(),
  };

  const mockScoringService = {
    calculateScore: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubmissionService,
        {
          provide: getRepositoryToken(Submission),
          useValue: mockSubmissionRepository,
        },
        {
          provide: getRepositoryToken(FinalScore),
          useValue: mockFinalScoreRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: ScoringService,
          useValue: mockScoringService,
        },
      ],
    }).compile();

    service = module.get<SubmissionService>(SubmissionService);
    submissionRepository = module.get(getRepositoryToken(Submission));
    finalScoreRepository = module.get(getRepositoryToken(FinalScore));
    dataSource = module.get(DataSource);
    scoringService = module.get<ScoringService>(ScoringService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    const createSubmissionDto: CreateSubmissionDto = {
      submissionId: "SUB-001",
      formData: { indicator1: 10, indicator2: 20 },
    };

    it("should create submission successfully for Nodal Officer", async () => {
      mockSubmissionRepository.findOne.mockResolvedValue(null);
      mockSubmissionRepository.create.mockReturnValue({
        ...createSubmissionDto,
        id: "submission-id",
        submittedBy: "user-id",
        stateUt: "Maharashtra",
        status: SubmissionStatus.SUBMITTED_TO_STATE,
        currentOwnerRole: UserRole.STATE_APPROVER,
      });
      mockSubmissionRepository.save.mockResolvedValue({
        ...createSubmissionDto,
        id: "submission-id",
      });

      const result = await service.create(
        createSubmissionDto,
        "user-id",
        UserRole.NODAL_OFFICER,
        "Maharashtra"
      );

      expect(result).toBeDefined();
      expect(mockSubmissionRepository.findOne).toHaveBeenCalledWith({
        where: { submissionId: createSubmissionDto.submissionId },
      });
      expect(mockSubmissionRepository.create).toHaveBeenCalled();
      expect(mockSubmissionRepository.save).toHaveBeenCalled();
    });

    it("should throw ForbiddenException for non-Nodal Officer", async () => {
      await expect(
        service.create(
          createSubmissionDto,
          "user-id",
          UserRole.STATE_APPROVER,
          "Maharashtra"
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw BadRequestException for duplicate submission ID", async () => {
      mockSubmissionRepository.findOne.mockResolvedValue({
        id: "existing-submission",
      });

      await expect(
        service.create(
          createSubmissionDto,
          "user-id",
          UserRole.NODAL_OFFICER,
          "Maharashtra"
        )
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("findOne", () => {
    const mockSubmission = {
      id: "submission-id",
      submittedBy: "user-id",
      stateUt: "Maharashtra",
      status: SubmissionStatus.SUBMITTED_TO_STATE,
    };

    it("should return submission for authorized user", async () => {
      mockSubmissionRepository.findOne.mockResolvedValue(mockSubmission);

      const result = await service.findOne(
        "submission-id",
        UserRole.NODAL_OFFICER,
        "Maharashtra"
      );

      expect(result).toEqual(mockSubmission);
      expect(mockSubmissionRepository.findOne).toHaveBeenCalledWith({
        where: { id: "submission-id" },
        relations: ["user", "finalScore"],
      });
    });

    it("should throw NotFoundException if submission not found", async () => {
      mockSubmissionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findOne(
          "non-existent-id",
          UserRole.NODAL_OFFICER,
          "Maharashtra"
        )
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException for unauthorized access", async () => {
      mockSubmissionRepository.findOne.mockResolvedValue(mockSubmission);

      await expect(
        service.findOne(
          "submission-id",
          UserRole.NODAL_OFFICER,
          "DifferentState"
        )
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("forwardToMoSPI", () => {
    const forwardDto: ForwardToMoSPIDto = { comment: "Forwarding to MoSPI" };
    const mockSubmission = {
      id: "submission-id",
      status: SubmissionStatus.SUBMITTED_TO_STATE,
      reviewComments: [],
    };

    it("should forward submission to MoSPI successfully", async () => {
      mockSubmissionRepository.findOne.mockResolvedValue(mockSubmission);
      mockDataSource.transaction.mockImplementation(async (callback) => {
        return callback({
          update: jest.fn().mockResolvedValue({}),
        });
      });

      const result = await service.forwardToMoSPI(
        "submission-id",
        forwardDto,
        "user-id",
        UserRole.STATE_APPROVER,
        "Maharashtra"
      );

      expect(result).toBeDefined();
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it("should throw ForbiddenException for non-State Approver", async () => {
      await expect(
        service.forwardToMoSPI(
          "submission-id",
          forwardDto,
          "user-id",
          UserRole.NODAL_OFFICER,
          "Maharashtra"
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw BadRequestException for wrong status", async () => {
      mockSubmissionRepository.findOne.mockResolvedValue({
        ...mockSubmission,
        status: SubmissionStatus.APPROVED,
      });

      await expect(
        service.forwardToMoSPI(
          "submission-id",
          forwardDto,
          "user-id",
          UserRole.STATE_APPROVER,
          "Maharashtra"
        )
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("stateReject", () => {
    const rejectDto: StateRejectDto = {
      status: SubmissionStatus.REJECTED,
      comment: "Rejected by state",
      sectionId: "test-section",
    };
    const mockSubmission = {
      id: "submission-id",
      status: SubmissionStatus.SUBMITTED_TO_STATE,
      reviewComments: [],
    };

    it("should reject submission successfully", async () => {
      mockSubmissionRepository.findOne.mockResolvedValue(mockSubmission);
      mockDataSource.transaction.mockImplementation(async (callback) => {
        return callback({
          update: jest.fn().mockResolvedValue({}),
        });
      });

      const result = await service.stateReject(
        "submission-id",
        rejectDto,
        "user-id",
        UserRole.STATE_APPROVER,
        "Maharashtra"
      );

      expect(result).toBeDefined();
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it("should throw ForbiddenException for non-State Approver", async () => {
      await expect(
        service.stateReject(
          "submission-id",
          rejectDto,
          "user-id",
          UserRole.NODAL_OFFICER,
          "Maharashtra"
        )
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("finalReject", () => {
    const rejectDto: FinalRejectDto = {
      status: SubmissionStatus.REJECTED_FINAL,
      comment: "Final rejection",
      sectionId: "test-section",
    };
    const mockSubmission = {
      id: "submission-id",
      status: SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER,
      rejectionCount: 0,
      reviewComments: [],
    };

    it("should reject submission with rejection count < 1", async () => {
      mockSubmissionRepository.findOne.mockResolvedValue(mockSubmission);
      mockDataSource.transaction.mockImplementation(async (callback) => {
        return callback({
          update: jest.fn().mockResolvedValue({}),
        });
      });

      const result = await service.finalReject(
        "submission-id",
        rejectDto,
        "user-id",
        UserRole.MOSPI_APPROVER,
        "Maharashtra"
      );

      expect(result).toBeDefined();
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it("should throw ForbiddenException for non-MoSPI Approver", async () => {
      await expect(
        service.finalReject(
          "submission-id",
          rejectDto,
          "user-id",
          UserRole.STATE_APPROVER,
          "Maharashtra"
        )
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("approve", () => {
    const mockSubmission = {
      id: "submission-id",
      status: SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER,
      reviewComments: [],
    };

    it("should approve submission and calculate score", async () => {
      mockSubmissionRepository.findOne.mockResolvedValue(mockSubmission);
      mockDataSource.transaction.mockImplementation(async (callback) => {
        return callback({
          update: jest.fn().mockResolvedValue({}),
        });
      });
      mockScoringService.calculateScore.mockResolvedValue({});

      const result = await service.approve(
        "submission-id",
        { status: SubmissionStatus.APPROVED, comment: "Approved" },
        "user-id",
        UserRole.MOSPI_APPROVER,
        "Maharashtra"
      );

      expect(result).toBeDefined();
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockScoringService.calculateScore).toHaveBeenCalledWith(
        "submission-id",
        "user-id"
      );
    });

    it("should throw ForbiddenException for non-MoSPI Approver", async () => {
      await expect(
        service.approve(
          "submission-id",
          { status: SubmissionStatus.APPROVED, comment: "Approved" },
          "user-id",
          UserRole.STATE_APPROVER,
          "Maharashtra"
        )
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("updateStatus", () => {
    it("should update submission status successfully", async () => {
      const mockSubmission = {
        id: "submission-id",
        status: SubmissionStatus.DRAFT,
        reviewComments: [],
      };

      submissionRepository.findOne.mockResolvedValue(mockSubmission);
      submissionRepository.update.mockResolvedValue({ affected: 1 });
      submissionRepository.findOne
        .mockResolvedValueOnce(mockSubmission)
        .mockResolvedValueOnce({
          ...mockSubmission,
          status: SubmissionStatus.SUBMITTED_TO_STATE,
          currentOwnerRole: UserRole.STATE_APPROVER,
        });

      const result = await service.updateStatus(
        "submission-id",
        {
          status: SubmissionStatus.SUBMITTED_TO_STATE,
          comment: "Test comment",
        },
        "user-id",
        UserRole.NODAL_OFFICER,
        "Maharashtra"
      );

      expect(submissionRepository.update).toHaveBeenCalledWith(
        "submission-id",
        {
          status: SubmissionStatus.SUBMITTED_TO_STATE,
          currentOwnerRole: UserRole.STATE_APPROVER,
          reviewComments: expect.any(Array),
        }
      );
      expect(result.status).toBe(SubmissionStatus.SUBMITTED_TO_STATE);
    });

    it("should throw BadRequestException for invalid status transition", async () => {
      const mockSubmission = {
        id: "submission-id",
        status: SubmissionStatus.APPROVED,
        reviewComments: [],
      };

      submissionRepository.findOne.mockResolvedValue(mockSubmission);

      await expect(
        service.updateStatus(
          "submission-id",
          { status: SubmissionStatus.DRAFT },
          "user-id",
          UserRole.NODAL_OFFICER,
          "Maharashtra"
        )
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("forwardToMoSPIReviewer", () => {
    it("should forward submission to MoSPI Reviewer successfully", async () => {
      const mockSubmission = {
        id: "submission-id",
        status: SubmissionStatus.SUBMITTED_TO_STATE,
        reviewComments: [],
      };

      submissionRepository.findOne.mockResolvedValue(mockSubmission);
      submissionRepository.update.mockResolvedValue({ affected: 1 });
      submissionRepository.findOne
        .mockResolvedValueOnce(mockSubmission)
        .mockResolvedValueOnce({
          ...mockSubmission,
          status: SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
          currentOwnerRole: UserRole.MOSPI_REVIEWER,
        });

      const result = await service.forwardToMoSPIReviewer(
        "submission-id",
        {
          status: SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
          comment: "Forwarding to MoSPI Reviewer",
          sectionId: "test-section",
        },
        "user-id",
        UserRole.STATE_APPROVER,
        "Maharashtra"
      );

      expect(submissionRepository.update).toHaveBeenCalledWith(
        "submission-id",
        {
          status: SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
          currentOwnerRole: UserRole.MOSPI_REVIEWER,
          reviewComments: expect.any(Array),
        }
      );
      expect(result.status).toBe(SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER);
    });

    it("should throw BadRequestException if submission is not in SUBMITTED_TO_STATE", async () => {
      const mockSubmission = {
        id: "submission-id",
        status: SubmissionStatus.DRAFT,
        reviewComments: [],
      };

      submissionRepository.findOne.mockResolvedValue(mockSubmission);

      await expect(
        service.forwardToMoSPIReviewer(
          "submission-id",
          {
            status: SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
            comment: "Test",
            sectionId: "test-section",
          },
          "user-id",
          UserRole.STATE_APPROVER,
          "Maharashtra"
        )
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("forwardToMoSPIApprover", () => {
    it("should forward submission to MoSPI Approver successfully", async () => {
      const mockSubmission = {
        id: "submission-id",
        status: SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
        reviewComments: [],
      };

      submissionRepository.findOne.mockResolvedValue(mockSubmission);
      submissionRepository.update.mockResolvedValue({ affected: 1 });
      submissionRepository.findOne
        .mockResolvedValueOnce(mockSubmission)
        .mockResolvedValueOnce({
          ...mockSubmission,
          status: SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER,
          currentOwnerRole: UserRole.MOSPI_APPROVER,
        });

      const result = await service.forwardToMoSPIApprover(
        "submission-id",
        {
          status: SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER,
          comment: "Forwarding to MoSPI Approver",
          sectionId: "test-section",
        },
        "user-id",
        UserRole.MOSPI_REVIEWER,
        "Maharashtra"
      );

      expect(submissionRepository.update).toHaveBeenCalledWith(
        "submission-id",
        {
          status: SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER,
          currentOwnerRole: UserRole.MOSPI_APPROVER,
          reviewComments: expect.any(Array),
        }
      );
      expect(result.status).toBe(SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER);
    });

    it("should throw BadRequestException if submission is not in SUBMITTED_TO_MOSPI_REVIEWER", async () => {
      const mockSubmission = {
        id: "submission-id",
        status: SubmissionStatus.DRAFT,
        reviewComments: [],
      };

      submissionRepository.findOne.mockResolvedValue(mockSubmission);

      await expect(
        service.forwardToMoSPIApprover(
          "submission-id",
          {
            status: SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER,
            comment: "Test",
            sectionId: "test-section",
          },
          "user-id",
          UserRole.MOSPI_REVIEWER,
          "Maharashtra"
        )
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("sendBackToState", () => {
    it("should send submission back to state successfully", async () => {
      const mockSubmission = {
        id: "submission-id",
        status: SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
        reviewComments: [],
        rejectionCount: 0,
      };

      submissionRepository.findOne.mockResolvedValue(mockSubmission);
      submissionRepository.update.mockResolvedValue({ affected: 1 });
      submissionRepository.findOne
        .mockResolvedValueOnce(mockSubmission)
        .mockResolvedValueOnce({
          ...mockSubmission,
          status: SubmissionStatus.SUBMITTED_TO_STATE,
          currentOwnerRole: UserRole.STATE_APPROVER,
          rejectionCount: 1,
        });

      const result = await service.sendBackToState(
        "submission-id",
        {
          status: SubmissionStatus.SUBMITTED_TO_STATE,
          comment: "Send back for corrections",
          sectionId: "test-section",
        },
        "user-id",
        UserRole.MOSPI_REVIEWER,
        "Maharashtra"
      );

      expect(submissionRepository.update).toHaveBeenCalledWith(
        "submission-id",
        {
          status: SubmissionStatus.SUBMITTED_TO_STATE,
          currentOwnerRole: UserRole.STATE_APPROVER,
          reviewComments: expect.any(Array),
          rejectionCount: expect.any(Function),
        }
      );
      expect(result.status).toBe(SubmissionStatus.SUBMITTED_TO_STATE);
    });

    it("should throw BadRequestException if submission is not in MoSPI status", async () => {
      const mockSubmission = {
        id: "submission-id",
        status: SubmissionStatus.DRAFT,
        reviewComments: [],
      };

      submissionRepository.findOne.mockResolvedValue(mockSubmission);

      await expect(
        service.sendBackToState(
          "submission-id",
          {
            status: SubmissionStatus.SUBMITTED_TO_STATE,
            comment: "Test",
            sectionId: "test-section",
          },
          "user-id",
          UserRole.MOSPI_REVIEWER,
          "Maharashtra"
        )
      ).rejects.toThrow(BadRequestException);
    });
  });
});
