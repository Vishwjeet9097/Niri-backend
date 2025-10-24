import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import * as request from 'supertest';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';
import { User, UserRole } from '../src/entities/user.entity';
import { Submission, SubmissionStatus } from '../src/entities/submission.entity';
import { FinalScore } from '../src/entities/final-score.entity';

describe('NIRI Scoring System E2E Tests', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authTokens: {
    nodalOfficer: string;
    stateApprover: string;
    mospiReviewer: string;
    mospiApprover: string;
  };
  let testSubmissionId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT) || 5432,
          username: process.env.DB_USERNAME || 'test_user',
          password: process.env.DB_PASSWORD || 'test_password',
          database: process.env.DB_DATABASE || 'niri_test_db',
          entities: [User, Submission, FinalScore],
          synchronize: true,
          dropSchema: true,
        }),
        AppModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    await app.init();
  });

  beforeEach(async () => {
    // Clean database
    await dataSource.synchronize(true);
    
    // Create test users
    await createTestUsers();
    
    // Get auth tokens
    authTokens = await getAuthTokens();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Complete Scoring Flow', () => {
    it('should complete full scoring workflow', async () => {
      // Step 1: Create submission with complete form data
      const submissionResponse = await request(app.getHttpServer())
        .post('/submission')
        .set('Authorization', `Bearer ${authTokens.nodalOfficer}`)
        .send({
          submissionId: 'TEST-SCORING-001',
          formData: getCompleteFormData(),
          status: 'SUBMITTED_TO_STATE'
        });

      expect(submissionResponse.status).toBe(201);
      expect(submissionResponse.body.status).toBe(true);
      testSubmissionId = submissionResponse.body.data.id;

      // Step 2: Forward to MoSPI (State Approver)
      const forwardResponse = await request(app.getHttpServer())
        .patch(`/submission/${testSubmissionId}/forward`)
        .set('Authorization', `Bearer ${authTokens.stateApprover}`)
        .send({
          comment: 'Approved by State - Ready for MoSPI review'
        });

      expect(forwardResponse.status).toBe(200);
      expect(forwardResponse.body.data.status).toBe('SUBMITTED_TO_MOSPI_REVIEWER');

      // Step 3: Final approval (MoSPI Approver)
      const approveResponse = await request(app.getHttpServer())
        .patch(`/submission/${testSubmissionId}/approve`)
        .set('Authorization', `Bearer ${authTokens.mospiApprover}`)
        .send({
          comment: 'Final approval granted by MoSPI'
        });

      expect(approveResponse.status).toBe(200);
      expect(approveResponse.body.data.status).toBe('APPROVED');

      // Step 4: Calculate score
      const scoreResponse = await request(app.getHttpServer())
        .get(`/scoring/calculate/${testSubmissionId}`)
        .set('Authorization', `Bearer ${authTokens.mospiApprover}`);

      expect(scoreResponse.status).toBe(200);
      expect(scoreResponse.body.status).toBe(true);
      expect(scoreResponse.body.data.totalScore).toBeGreaterThan(0);
      expect(scoreResponse.body.data.totalScore).toBeLessThanOrEqual(1000);
      expect(scoreResponse.body.data.scoringVersion).toBe('2.0');
      expect(scoreResponse.body.data.scoreBreakdown.categories).toHaveLength(4);
    });

    it('should validate form data structure', async () => {
      const validationResponse = await request(app.getHttpServer())
        .post('/scoring/validate-form-data')
        .set('Authorization', `Bearer ${authTokens.nodalOfficer}`)
        .send(getCompleteFormData());

      expect(validationResponse.status).toBe(200);
      expect(validationResponse.body.status).toBe(true);
      expect(validationResponse.body.data.isValid).toBe(true);
      expect(validationResponse.body.data.scoreEstimate).toBeGreaterThan(0);
    });

    it('should get detailed score breakdown', async () => {
      // First create and approve submission
      await createAndApproveSubmission();
      
      const detailedResponse = await request(app.getHttpServer())
        .get(`/scoring/detailed/${testSubmissionId}`)
        .set('Authorization', `Bearer ${authTokens.mospiApprover}`);

      expect(detailedResponse.status).toBe(200);
      expect(detailedResponse.body.status).toBe(true);
      expect(detailedResponse.body.data.categories).toHaveLength(4);
      expect(detailedResponse.body.data.methodology).toContain('v2.0');
    });

    it('should get score rankings', async () => {
      // Create multiple submissions for ranking test
      await createAndApproveSubmission();
      await createAndApproveSubmission('TEST-SCORING-002');
      
      const rankingsResponse = await request(app.getHttpServer())
        .get('/scoring/rankings')
        .set('Authorization', `Bearer ${authTokens.mospiApprover}`);

      expect(rankingsResponse.status).toBe(200);
      expect(rankingsResponse.body.status).toBe(true);
      expect(rankingsResponse.body.data).toHaveLength(2);
      expect(rankingsResponse.body.data[0].rank).toBe(1);
    });

    it('should get comprehensive statistics', async () => {
      // Create multiple submissions for statistics
      await createAndApproveSubmission();
      await createAndApproveSubmission('TEST-SCORING-002');
      
      const statsResponse = await request(app.getHttpServer())
        .get('/scoring/statistics')
        .set('Authorization', `Bearer ${authTokens.mospiApprover}`);

      expect(statsResponse.status).toBe(200);
      expect(statsResponse.body.status).toBe(true);
      expect(statsResponse.body.data.totalStates).toBe(2);
      expect(statsResponse.body.data.maxPossibleScore).toBe(1000);
      expect(statsResponse.body.data.categoryStatistics).toHaveProperty('infraFinancing');
      expect(statsResponse.body.data.categoryStatistics).toHaveProperty('infraDevelopment');
      expect(statsResponse.body.data.categoryStatistics).toHaveProperty('pppDevelopment');
      expect(statsResponse.body.data.categoryStatistics).toHaveProperty('infraEnablers');
    });

    it('should get category-specific scores', async () => {
      await createAndApproveSubmission();
      
      const categoryResponse = await request(app.getHttpServer())
        .get('/scoring/category/Infra Financing')
        .set('Authorization', `Bearer ${authTokens.mospiApprover}`);

      expect(categoryResponse.status).toBe(200);
      expect(categoryResponse.body.status).toBe(true);
      expect(categoryResponse.body.data).toHaveLength(1);
      expect(categoryResponse.body.data[0].categoryScore).toBeGreaterThan(0);
    });

    it('should get scoring methodology', async () => {
      const methodologyResponse = await request(app.getHttpServer())
        .get('/scoring/methodology')
        .set('Authorization', `Bearer ${authTokens.mospiApprover}`);

      expect(methodologyResponse.status).toBe(200);
      expect(methodologyResponse.body.status).toBe(true);
      expect(methodologyResponse.body.data.version).toBe('2.0');
      expect(methodologyResponse.body.data.totalMarks).toBe(1000);
      expect(methodologyResponse.body.data.categories).toHaveLength(4);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid submission ID', async () => {
      const response = await request(app.getHttpServer())
        .get('/scoring/calculate/invalid-id')
        .set('Authorization', `Bearer ${authTokens.mospiApprover}`);

      expect(response.status).toBe(400);
      expect(response.body.status).toBe(false);
    });

    it('should handle unauthorized access', async () => {
      const response = await request(app.getHttpServer())
        .get('/scoring/calculate/test-id')
        .set('Authorization', `Bearer ${authTokens.nodalOfficer}`);

      expect(response.status).toBe(403);
    });

    it('should handle non-existent submission', async () => {
      const response = await request(app.getHttpServer())
        .get('/scoring/calculate/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authTokens.mospiApprover}`);

      expect(response.status).toBe(404);
    });

    it('should handle scoring non-approved submission', async () => {
      // Create submission but don't approve
      const submissionResponse = await request(app.getHttpServer())
        .post('/submission')
        .set('Authorization', `Bearer ${authTokens.nodalOfficer}`)
        .send({
          submissionId: 'TEST-NOT-APPROVED',
          formData: getCompleteFormData(),
          status: 'SUBMITTED_TO_STATE'
        });

      const response = await request(app.getHttpServer())
        .get(`/scoring/calculate/${submissionResponse.body.data.id}`)
        .set('Authorization', `Bearer ${authTokens.mospiApprover}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Can only calculate score for approved submissions');
    });
  });

  describe('Scoring Calculations', () => {
    it('should calculate correct scores for Infra Financing', async () => {
      await createAndApproveSubmission();
      
      const scoreResponse = await request(app.getHttpServer())
        .get(`/scoring/detailed/${testSubmissionId}`)
        .set('Authorization', `Bearer ${authTokens.mospiApprover}`);

      const infraFinancing = scoreResponse.body.data.categories.find(
        cat => cat.categoryName === 'Infra Financing'
      );

      expect(infraFinancing).toBeDefined();
      expect(infraFinancing.categoryScore).toBeGreaterThan(0);
      expect(infraFinancing.categoryScore).toBeLessThanOrEqual(250);
      expect(infraFinancing.calculations).toHaveLength(5);
    });

    it('should handle binary logic correctly', async () => {
      const formDataWithBinary = {
        ...getCompleteFormData(),
        infraFinancing: {
          ...getCompleteFormData().infraFinancing,
          financialIntermediary: {
            hasIntermediary: false,
            subSectors: [],
            documentUploaded: false
          }
        }
      };

      const validationResponse = await request(app.getHttpServer())
        .post('/scoring/validate-form-data')
        .set('Authorization', `Bearer ${authTokens.nodalOfficer}`)
        .send(formDataWithBinary);

      expect(validationResponse.status).toBe(200);
      expect(validationResponse.body.data.isValid).toBe(true);
    });

    it('should handle array-based calculations', async () => {
      const formDataWithArrays = {
        ...getCompleteFormData(),
        infraDevelopment: {
          ...getCompleteFormData().infraDevelopment,
          projectPipeline: {
            projects: [
              { projectName: 'Project 1', documentUploaded: true },
              { projectName: 'Project 2', documentUploaded: true },
              { projectName: 'Project 3', documentUploaded: false }
            ]
          }
        }
      };

      const validationResponse = await request(app.getHttpServer())
        .post('/scoring/validate-form-data')
        .set('Authorization', `Bearer ${authTokens.nodalOfficer}`)
        .send(formDataWithArrays);

      expect(validationResponse.status).toBe(200);
      expect(validationResponse.body.data.isValid).toBe(true);
    });
  });

  // Helper functions
  async function createTestUsers() {
    const users = [
      {
        email: 'nodal.test@maharashtra.gov.in',
        password: 'password123',
        firstName: 'Nodal',
        lastName: 'Test',
        role: UserRole.NODAL_OFFICER,
        stateUt: 'Maharashtra'
      },
      {
        email: 'state.test@maharashtra.gov.in',
        password: 'password123',
        firstName: 'State',
        lastName: 'Test',
        role: UserRole.STATE_APPROVER,
        stateUt: 'Maharashtra'
      },
      {
        email: 'mospi.reviewer@mospi.gov.in',
        password: 'password123',
        firstName: 'MoSPI',
        lastName: 'Reviewer',
        role: UserRole.MOSPI_REVIEWER,
        stateUt: 'Central'
      },
      {
        email: 'mospi.approver@mospi.gov.in',
        password: 'password123',
        firstName: 'MoSPI',
        lastName: 'Approver',
        role: UserRole.MOSPI_APPROVER,
        stateUt: 'Central'
      }
    ];

    for (const user of users) {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(user);
    }
  }

  async function getAuthTokens() {
    const tokens = {};
    
    const roles = ['nodalOfficer', 'stateApprover', 'mospiReviewer', 'mospiApprover'];
    const emails = [
      'nodal.test@maharashtra.gov.in',
      'state.test@maharashtra.gov.in',
      'mospi.reviewer@mospi.gov.in',
      'mospi.approver@mospi.gov.in'
    ];

    for (let i = 0; i < roles.length; i++) {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: emails[i],
          password: 'password123'
        });
      
      tokens[roles[i]] = response.body.accessToken;
    }

    return tokens as any;
  }

  async function createAndApproveSubmission(submissionId = 'TEST-SCORING-001') {
    // Create submission
    const submissionResponse = await request(app.getHttpServer())
      .post('/submission')
      .set('Authorization', `Bearer ${authTokens.nodalOfficer}`)
      .send({
        submissionId,
        formData: getCompleteFormData(),
        status: 'SUBMITTED_TO_STATE'
      });

    testSubmissionId = submissionResponse.body.data.id;

    // Forward to MoSPI
    await request(app.getHttpServer())
      .patch(`/submission/${testSubmissionId}/forward`)
      .set('Authorization', `Bearer ${authTokens.stateApprover}`)
      .send({ comment: 'Forwarded to MoSPI' });

    // Approve
    await request(app.getHttpServer())
      .patch(`/submission/${testSubmissionId}/approve`)
      .set('Authorization', `Bearer ${authTokens.mospiApprover}`)
      .send({ comment: 'Approved by MoSPI' });
  }

  function getCompleteFormData() {
    return {
      infraFinancing: {
        capexToGSDP: {
          capitalAllocation: 50000,
          gsdp: 500000,
          percentage: 10
        },
        capexUtilization: {
          actualCapex: 45000,
          allocatedCapex: 50000,
          percentage: 90
        },
        creditRatedULBs: {
          ratedULBs: 15,
          totalULBs: 30,
          percentage: 50
        },
        ulbBonds: {
          approvedULBs: 8,
          totalULBs: 30,
          percentage: 26.67
        },
        financialIntermediary: {
          hasIntermediary: true,
          subSectors: ['Transport', 'Water', 'Energy'],
          documentUploaded: true
        }
      },
      infraDevelopment: {
        infrastructureAct: {
          selectedSectors: ['Transport', 'Water', 'Energy', 'Urban Development'],
          hasOverarching: true,
          documentUploaded: true
        },
        specializedEntity: {
          selectedSectors: ['Transport', 'Water'],
          documentUploaded: true
        },
        sectorPlan: {
          selectedSectors: ['Transport', 'Water', 'Energy'],
          hasOverarching: false,
          documentUploaded: true
        },
        projectPipeline: {
          projects: [
            {
              projectName: 'Highway Project A',
              documentUploaded: true
            },
            {
              projectName: 'Water Treatment Plant B',
              documentUploaded: true
            }
          ]
        },
        assetMonetization: {
          assets: [
            {
              assetName: 'Toll Road Asset 1',
              documentUploaded: true
            }
          ]
        }
      },
      pppDevelopment: {
        pppAct: {
          hasAct: 'yes',
          documentUploaded: true
        },
        pppCell: {
          hasCell: true,
          documentUploaded: true
        },
        vgfIipdfProposals: {
          proposals: [
            {
              projectName: 'VGF Project 1',
              documentUploaded: true
            },
            {
              projectName: 'IIPDF Project 2',
              documentUploaded: true
            }
          ]
        },
        pppProportion: {
          pppProjectCost: 20000,
          totalInfraCost: 50000,
          percentage: 40
        }
      },
      infraEnablers: {
        nipPortal: {
          allProjectsListed: true,
          documentUploaded: true
        },
        statePMG: {
          hasPMG: true,
          documentOrUrl: 'https://statepmg.example.com'
        },
        gatiShakti: {
          projects: [
            {
              projectName: 'GatiShakti Project 1',
              evidenceUploaded: true
            },
            {
              projectName: 'GatiShakti Project 2',
              evidenceUploaded: true
            }
          ]
        },
        adr: {
          hasADR: true,
          documentUploaded: true
        },
        innovativePractices: {
          practices: [
            {
              practiceName: 'Digital Payment Integration',
              evidenceUploaded: true
            },
            {
              practiceName: 'AI-based Traffic Management',
              evidenceUploaded: true
            }
          ]
        },
        capacityBuilding: {
          officers: [
            {
              officerName: 'John Doe',
              designation: 'Chief Engineer',
              trainingCompleted: true
            },
            {
              officerName: 'Jane Smith',
              designation: 'Project Manager',
              trainingCompleted: true
            }
          ]
        }
      }
    };
  }
});




