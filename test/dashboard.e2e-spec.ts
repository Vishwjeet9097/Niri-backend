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

describe('Dashboard E2E Tests', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authTokens: {
    nodalOfficer: string;
    stateApprover: string;
    mospiReviewer: string;
    mospiApprover: string;
  };

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

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean database before each test
    await dataSource.synchronize(true);

    // Create test users and get auth tokens
    await createTestUsers();
    await getAuthTokens();
    await createTestData();
  });

  async function createTestUsers() {
    const userRepository = dataSource.getRepository(User);

    const users = [
      {
        email: 'nodal@test.com',
        password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K',
        firstName: 'Nodal',
        lastName: 'Officer',
        role: UserRole.NODAL_OFFICER,
        stateUt: 'Maharashtra',
        isActive: true,
      },
      {
        email: 'state@test.com',
        password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K',
        firstName: 'State',
        lastName: 'Approver',
        role: UserRole.STATE_APPROVER,
        stateUt: 'Maharashtra',
        isActive: true,
      },
      {
        email: 'mospi.reviewer@test.com',
        password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K',
        firstName: 'MoSPI',
        lastName: 'Reviewer',
        role: UserRole.MOSPI_REVIEWER,
        stateUt: 'Central',
        isActive: true,
      },
      {
        email: 'mospi.approver@test.com',
        password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K',
        firstName: 'MoSPI',
        lastName: 'Approver',
        role: UserRole.MOSPI_APPROVER,
        stateUt: 'Central',
        isActive: true,
      },
    ];

    await userRepository.save(users);
  }

  async function getAuthTokens() {
    const loginRequests = [
      { email: 'nodal@test.com', password: 'password123' },
      { email: 'state@test.com', password: 'password123' },
      { email: 'mospi.reviewer@test.com', password: 'password123' },
      { email: 'mospi.approver@test.com', password: 'password123' },
    ];

    const responses = await Promise.all(
      loginRequests.map((loginData) =>
        request(app.getHttpServer()).post('/auth/login').send(loginData),
      ),
    );

    authTokens = {
      nodalOfficer: responses[0].body.data.accessToken,
      stateApprover: responses[1].body.data.accessToken,
      mospiReviewer: responses[2].body.data.accessToken,
      mospiApprover: responses[3].body.data.accessToken,
    };
  }

  async function createTestData() {
    const submissionRepository = dataSource.getRepository(Submission);
    const finalScoreRepository = dataSource.getRepository(FinalScore);

    // Create test submissions with different statuses
    const submissions = [
      {
        submissionId: 'SUB-001',
        stateUt: 'Maharashtra',
        status: SubmissionStatus.DRAFT,
        formData: { indicator1: 10 },
        currentOwnerRole: UserRole.NODAL_OFFICER,
        createdBy: 'nodal@test.com',
      },
      {
        submissionId: 'SUB-002',
        stateUt: 'Maharashtra',
        status: SubmissionStatus.SUBMITTED_TO_STATE,
        formData: { indicator1: 15 },
        currentOwnerRole: UserRole.STATE_APPROVER,
        createdBy: 'nodal@test.com',
      },
      {
        submissionId: 'SUB-003',
        stateUt: 'Maharashtra',
        status: SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
        formData: { indicator1: 20 },
        currentOwnerRole: UserRole.MOSPI_REVIEWER,
        createdBy: 'nodal@test.com',
      },
      {
        submissionId: 'SUB-004',
        stateUt: 'Maharashtra',
        status: SubmissionStatus.APPROVED,
        formData: { indicator1: 25 },
        currentOwnerRole: UserRole.NODAL_OFFICER,
        createdBy: 'nodal@test.com',
      },
      {
        submissionId: 'SUB-005',
        stateUt: 'Karnataka',
        status: SubmissionStatus.APPROVED,
        formData: { indicator1: 30 },
        currentOwnerRole: UserRole.NODAL_OFFICER,
        createdBy: 'nodal@test.com',
      },
    ];

    const savedSubmissions = await submissionRepository.save(submissions);

    // Create final scores for approved submissions
    const finalScores = [
      {
        submissionId: savedSubmissions[3].id,
        stateUt: 'Maharashtra',
        totalScore: 85.5,
        scoreBreakdown: {
          capexToGsdpRatio: 20,
          infrastructureInvestment: 18,
          projectCompletionRate: 17,
          qualityIndex: 16,
          sustainabilityScore: 14.5,
        },
        methodology: 'Standard NIRI Methodology',
        calculatedAt: new Date(),
      },
      {
        submissionId: savedSubmissions[4].id,
        stateUt: 'Karnataka',
        totalScore: 92.3,
        scoreBreakdown: {
          capexToGsdpRatio: 22,
          infrastructureInvestment: 20,
          projectCompletionRate: 19,
          qualityIndex: 18,
          sustainabilityScore: 13.3,
        },
        methodology: 'Standard NIRI Methodology',
        calculatedAt: new Date(),
      },
    ];

    await finalScoreRepository.save(finalScores);
  }

  describe('GET /dashboard/summary', () => {
    it('should get dashboard summary for NODAL_OFFICER', async () => {
      const response = await request(app.getHttpServer())
        .get('/dashboard/summary')
        .set('Authorization', `Bearer ${authTokens.nodalOfficer}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(true);
      expect(response.body.data).toHaveProperty('pendingSubmissions');
      expect(response.body.data).toHaveProperty('totalSubmissions');
      expect(response.body.data).toHaveProperty('approvedSubmissions');
      expect(response.body.data).toHaveProperty('rejectedSubmissions');
      expect(response.body.data).toHaveProperty('draftSubmissions');
    });

    it('should get dashboard summary for STATE_APPROVER', async () => {
      const response = await request(app.getHttpServer())
        .get('/dashboard/summary')
        .set('Authorization', `Bearer ${authTokens.stateApprover}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(true);
      expect(response.body.data).toHaveProperty('pendingSubmissions');
      expect(response.body.data).toHaveProperty('totalSubmissions');
      expect(response.body.data).toHaveProperty('stateSpecificData');
    });

    it('should get dashboard summary for MOSPI_REVIEWER', async () => {
      const response = await request(app.getHttpServer())
        .get('/dashboard/summary')
        .set('Authorization', `Bearer ${authTokens.mospiReviewer}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(true);
      expect(response.body.data).toHaveProperty('pendingSubmissions');
      expect(response.body.data).toHaveProperty('totalSubmissions');
      expect(response.body.data).toHaveProperty('nationalLevelData');
    });

    it('should get dashboard summary for MOSPI_APPROVER', async () => {
      const response = await request(app.getHttpServer())
        .get('/dashboard/summary')
        .set('Authorization', `Bearer ${authTokens.mospiApprover}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(true);
      expect(response.body.data).toHaveProperty('pendingSubmissions');
      expect(response.body.data).toHaveProperty('totalSubmissions');
      expect(response.body.data).toHaveProperty('nationalLevelData');
    });

    it('should reject request without authentication', async () => {
      const response = await request(app.getHttpServer()).get('/dashboard/summary');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /dashboard/kpis', () => {
    it('should get KPIs for NODAL_OFFICER', async () => {
      const response = await request(app.getHttpServer())
        .get('/dashboard/kpis')
        .set('Authorization', `Bearer ${authTokens.nodalOfficer}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(true);
      expect(response.body.data).toHaveProperty('submissionMetrics');
      expect(response.body.data).toHaveProperty('performanceMetrics');
      expect(response.body.data).toHaveProperty('timeMetrics');
    });

    it('should get KPIs for STATE_APPROVER', async () => {
      const response = await request(app.getHttpServer())
        .get('/dashboard/kpis')
        .set('Authorization', `Bearer ${authTokens.stateApprover}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(true);
      expect(response.body.data).toHaveProperty('stateMetrics');
      expect(response.body.data).toHaveProperty('approvalMetrics');
    });

    it('should get KPIs for MOSPI_REVIEWER', async () => {
      const response = await request(app.getHttpServer())
        .get('/dashboard/kpis')
        .set('Authorization', `Bearer ${authTokens.mospiReviewer}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(true);
      expect(response.body.data).toHaveProperty('reviewMetrics');
      expect(response.body.data).toHaveProperty('nationalMetrics');
    });

    it('should get KPIs for MOSPI_APPROVER', async () => {
      const response = await request(app.getHttpServer())
        .get('/dashboard/kpis')
        .set('Authorization', `Bearer ${authTokens.mospiApprover}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(true);
      expect(response.body.data).toHaveProperty('approvalMetrics');
      expect(response.body.data).toHaveProperty('nationalMetrics');
    });

    it('should include realistic KPI values', async () => {
      const response = await request(app.getHttpServer())
        .get('/dashboard/kpis')
        .set('Authorization', `Bearer ${authTokens.nodalOfficer}`);

      expect(response.status).toBe(200);

      const kpis = response.body.data;

      // Check that numeric values are reasonable
      if (kpis.submissionMetrics) {
        expect(typeof kpis.submissionMetrics.totalSubmissions).toBe('number');
        expect(kpis.submissionMetrics.totalSubmissions).toBeGreaterThanOrEqual(0);
      }

      if (kpis.performanceMetrics) {
        expect(typeof kpis.performanceMetrics.averageScore).toBe('number');
        expect(kpis.performanceMetrics.averageScore).toBeGreaterThanOrEqual(0);
        expect(kpis.performanceMetrics.averageScore).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Role-specific Dashboard Data', () => {
    it('should show state-specific data for STATE_APPROVER', async () => {
      const response = await request(app.getHttpServer())
        .get('/dashboard/summary')
        .set('Authorization', `Bearer ${authTokens.stateApprover}`);

      expect(response.status).toBe(200);

      const data = response.body.data;

      // State approver should see data filtered by their state
      if (data.stateSpecificData) {
        expect(data.stateSpecificData).toHaveProperty('stateUt');
        expect(data.stateSpecificData.stateUt).toBe('Maharashtra');
      }
    });

    it('should show national-level data for MOSPI roles', async () => {
      const response = await request(app.getHttpServer())
        .get('/dashboard/summary')
        .set('Authorization', `Bearer ${authTokens.mospiApprover}`);

      expect(response.status).toBe(200);

      const data = response.body.data;

      // MoSPI roles should see national-level data
      if (data.nationalLevelData) {
        expect(data.nationalLevelData).toHaveProperty('totalStates');
        expect(data.nationalLevelData).toHaveProperty('nationalAverage');
      }
    });

    it('should show different metrics for different roles', async () => {
      const nodalResponse = await request(app.getHttpServer())
        .get('/dashboard/kpis')
        .set('Authorization', `Bearer ${authTokens.nodalOfficer}`);

      const stateResponse = await request(app.getHttpServer())
        .get('/dashboard/kpis')
        .set('Authorization', `Bearer ${authTokens.stateApprover}`);

      expect(nodalResponse.status).toBe(200);
      expect(stateResponse.status).toBe(200);

      // Different roles should have different KPI structures
      const nodalKpis = nodalResponse.body.data;
      const stateKpis = stateResponse.body.data;

      // Nodal officer should have submission-focused metrics
      expect(nodalKpis).toHaveProperty('submissionMetrics');

      // State approver should have approval-focused metrics
      expect(stateKpis).toHaveProperty('stateMetrics');
    });
  });

  describe('Dashboard Performance', () => {
    it('should respond within reasonable time', async () => {
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .get('/dashboard/summary')
        .set('Authorization', `Bearer ${authTokens.nodalOfficer}`);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
    });

    it('should handle concurrent dashboard requests', async () => {
      const requests = [
        request(app.getHttpServer())
          .get('/dashboard/summary')
          .set('Authorization', `Bearer ${authTokens.nodalOfficer}`),
        request(app.getHttpServer())
          .get('/dashboard/kpis')
          .set('Authorization', `Bearer ${authTokens.nodalOfficer}`),
        request(app.getHttpServer())
          .get('/dashboard/summary')
          .set('Authorization', `Bearer ${authTokens.stateApprover}`),
        request(app.getHttpServer())
          .get('/dashboard/kpis')
          .set('Authorization', `Bearer ${authTokens.stateApprover}`),
      ];

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe(true);
      });
    });
  });
});
