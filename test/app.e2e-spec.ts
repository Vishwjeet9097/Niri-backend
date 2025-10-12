import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

import { AppModule } from '../src/app.module';
import { User, UserRole } from '../src/entities/user.entity';
import { Submission, SubmissionStatus } from '../src/entities/submission.entity';
import { FinalScore } from '../src/entities/final-score.entity';
import { AuditLog } from '../src/entities/audit-log.entity';

describe('NIRI Workflow E2E Tests', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authToken: string;
  let nodalOfficerToken: string;
  let stateApproverToken: string;
  let mospiReviewerToken: string;
  let mospiApproverToken: string;

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
          entities: [User, Submission, FinalScore, AuditLog],
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

    // Create test users
    await createTestUsers();

    // Get auth tokens
    await getAuthTokens();
  });

  async function createTestUsers() {
    const userRepository = dataSource.getRepository(User);

    const users = [
      {
        email: 'nodal@test.com',
        password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', // password123
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

    nodalOfficerToken = responses[0].body.accessToken;
    stateApproverToken = responses[1].body.accessToken;
    mospiReviewerToken = responses[2].body.accessToken;
    mospiApproverToken = responses[3].body.accessToken;
  }

  describe('Complete 4-Tier Workflow', () => {
    it('should complete the full workflow: Create -> State Approve -> MoSPI Review -> MoSPI Approve', async () => {
      // Step 1: Nodal Officer creates submission
      const createSubmissionResponse = await request(app.getHttpServer())
        .post('/submission')
        .set('Authorization', `Bearer ${nodalOfficerToken}`)
        .send({
          submissionId: 'SUB-001',
          formData: {
            capexToGsdpRatio: 5.5,
            infrastructureInvestment: 1000,
            projectCompletionRate: 85,
            qualityIndex: 8.5,
            sustainabilityScore: 7.5,
            innovationIndex: 6.5,
          },
        });

      expect(createSubmissionResponse.status).toBe(201);
      expect(createSubmissionResponse.body.status).toBe(SubmissionStatus.SUBMITTED_TO_STATE);
      expect(createSubmissionResponse.body.currentOwnerRole).toBe(UserRole.STATE_APPROVER);

      const submissionId = createSubmissionResponse.body.id;

      // Step 2: State Approver forwards to MoSPI
      const forwardResponse = await request(app.getHttpServer())
        .post(`/submission/forward-to-mospi/${submissionId}`)
        .set('Authorization', `Bearer ${stateApproverToken}`)
        .send({
          comment: 'Forwarding to MoSPI for review',
        });

      expect(forwardResponse.status).toBe(200);
      expect(forwardResponse.body.status).toBe(SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER);
      expect(forwardResponse.body.currentOwnerRole).toBe(UserRole.MOSPI_REVIEWER);

      // Step 3: MoSPI Reviewer adds comment
      const commentResponse = await request(app.getHttpServer())
        .post(`/submission/${submissionId}/comment`)
        .set('Authorization', `Bearer ${mospiReviewerToken}`)
        .send({
          text: 'Review completed, ready for approval',
          type: 'comment',
        });

      expect(commentResponse.status).toBe(201);

      // Step 4: MoSPI Approver approves submission
      const approveResponse = await request(app.getHttpServer())
        .post(`/submission/approve/${submissionId}`)
        .set('Authorization', `Bearer ${mospiApproverToken}`);

      expect(approveResponse.status).toBe(200);
      expect(approveResponse.body.status).toBe(SubmissionStatus.APPROVED);
      expect(approveResponse.body.currentOwnerRole).toBe(UserRole.NODAL_OFFICER);

      // Verify final score was calculated
      const finalScoreRepository = dataSource.getRepository(FinalScore);
      const finalScore = await finalScoreRepository.findOne({
        where: { submissionId },
      });

      expect(finalScore).toBeDefined();
      expect(finalScore.totalScore).toBeGreaterThan(0);
    });
  });

  describe('Single Rejection Rule', () => {
    it('should enforce single rejection rule correctly', async () => {
      // Create submission
      const createResponse = await request(app.getHttpServer())
        .post('/submission')
        .set('Authorization', `Bearer ${nodalOfficerToken}`)
        .send({
          submissionId: 'SUB-002',
          formData: { indicator1: 10 },
        });

      const submissionId = createResponse.body.id;

      // State Approver forwards to MoSPI
      await request(app.getHttpServer())
        .post(`/submission/forward-to-mospi/${submissionId}`)
        .set('Authorization', `Bearer ${stateApproverToken}`)
        .send({ comment: 'Forwarding' });

      // MoSPI Approver rejects (first rejection)
      const firstRejectResponse = await request(app.getHttpServer())
        .post(`/submission/final-reject/${submissionId}`)
        .set('Authorization', `Bearer ${mospiApproverToken}`)
        .send({ comment: 'First rejection' });

      expect(firstRejectResponse.status).toBe(200);
      expect(firstRejectResponse.body.status).toBe(SubmissionStatus.REJECTED);
      expect(firstRejectResponse.body.currentOwnerRole).toBe(UserRole.STATE_APPROVER);

      // Nodal Officer resubmits
      const resubmitResponse = await request(app.getHttpServer())
        .post(`/submission/resubmit/${submissionId}`)
        .set('Authorization', `Bearer ${nodalOfficerToken}`)
        .send({ comment: 'Resubmitting with corrections' });

      expect(resubmitResponse.status).toBe(200);
      expect(resubmitResponse.body.status).toBe(SubmissionStatus.SUBMITTED_TO_STATE);
      expect(resubmitResponse.body.rejectionCount).toBe(1);

      // State Approver forwards again
      await request(app.getHttpServer())
        .post(`/submission/forward-to-mospi/${submissionId}`)
        .set('Authorization', `Bearer ${stateApproverToken}`)
        .send({ comment: 'Forwarding again' });

      // MoSPI Approver rejects again (second rejection - should be final)
      const secondRejectResponse = await request(app.getHttpServer())
        .post(`/submission/final-reject/${submissionId}`)
        .set('Authorization', `Bearer ${mospiApproverToken}`)
        .send({ comment: 'Final rejection' });

      expect(secondRejectResponse.status).toBe(200);
      expect(secondRejectResponse.body.status).toBe(SubmissionStatus.REJECTED_FINAL);
      expect(secondRejectResponse.body.currentOwnerRole).toBe(UserRole.NODAL_OFFICER);
    });
  });

  describe('Role-Based Access Control', () => {
    it('should enforce role-based access correctly', async () => {
      // Create submission
      const createResponse = await request(app.getHttpServer())
        .post('/submission')
        .set('Authorization', `Bearer ${nodalOfficerToken}`)
        .send({
          submissionId: 'SUB-003',
          formData: { indicator1: 10 },
        });

      const submissionId = createResponse.body.id;

      // Nodal Officer should not be able to forward to MoSPI
      const unauthorizedForward = await request(app.getHttpServer())
        .post(`/submission/forward-to-mospi/${submissionId}`)
        .set('Authorization', `Bearer ${nodalOfficerToken}`)
        .send({ comment: 'Unauthorized' });

      expect(unauthorizedForward.status).toBe(403);

      // State Approver should not be able to approve
      const unauthorizedApprove = await request(app.getHttpServer())
        .post(`/submission/approve/${submissionId}`)
        .set('Authorization', `Bearer ${stateApproverToken}`);

      expect(unauthorizedApprove.status).toBe(403);

      // MoSPI Reviewer should not be able to approve
      const unauthorizedReviewerApprove = await request(app.getHttpServer())
        .post(`/submission/approve/${submissionId}`)
        .set('Authorization', `Bearer ${mospiReviewerToken}`);

      expect(unauthorizedReviewerApprove.status).toBe(403);
    });
  });

  describe('Dashboard and Reporting', () => {
    it('should provide role-specific dashboard data', async () => {
      // Create a few submissions
      await request(app.getHttpServer())
        .post('/submission')
        .set('Authorization', `Bearer ${nodalOfficerToken}`)
        .send({
          submissionId: 'SUB-004',
          formData: { indicator1: 10 },
        });

      // Get dashboard summary for Nodal Officer
      const dashboardResponse = await request(app.getHttpServer())
        .get('/dashboard/summary')
        .set('Authorization', `Bearer ${nodalOfficerToken}`);

      expect(dashboardResponse.status).toBe(200);
      expect(dashboardResponse.body).toHaveProperty('pendingSubmissions');
      expect(dashboardResponse.body).toHaveProperty('totalSubmissions');
    });

    it('should provide ranking data', async () => {
      // Get rankings (should be empty initially)
      const rankingResponse = await request(app.getHttpServer())
        .get('/report/ranking')
        .set('Authorization', `Bearer ${mospiApproverToken}`);

      expect(rankingResponse.status).toBe(200);
      expect(Array.isArray(rankingResponse.body)).toBe(true);
    });
  });

  describe('File Storage Integration', () => {
    let testSubmissionId: string;

    beforeEach(async () => {
      // Create a test submission
      const createResponse = await request(app.getHttpServer())
        .post('/submission')
        .set('Authorization', `Bearer ${nodalOfficerToken}`)
        .send({
          submissionId: 'SUB-FILE-TEST-001',
          formData: { indicator1: 10 },
        });

      testSubmissionId = createResponse.body.id;
    });

    it('should upload single file successfully', async () => {
      // Create a test file
      const testFileContent = 'This is a test file content';
      const testFilePath = path.join(__dirname, 'test-file.txt');
      fs.writeFileSync(testFilePath, testFileContent);

      const uploadResponse = await request(app.getHttpServer())
        .post(`/file/upload/${testSubmissionId}`)
        .set('Authorization', `Bearer ${nodalOfficerToken}`)
        .attach('file', testFilePath);

      expect(uploadResponse.status).toBe(201);
      expect(uploadResponse.body.data).toHaveProperty('fileName');
      expect(uploadResponse.body.data).toHaveProperty('filePath');
      expect(uploadResponse.body.data).toHaveProperty('fileUrl');

      // Clean up test file
      fs.unlinkSync(testFilePath);
    });

    it('should upload multiple files successfully', async () => {
      // Create test files
      const testFiles = [];
      for (let i = 0; i < 3; i++) {
        const testFilePath = path.join(__dirname, `test-file-${i}.txt`);
        fs.writeFileSync(testFilePath, `Test file content ${i}`);
        testFiles.push(testFilePath);
      }

      const uploadResponse = await request(app.getHttpServer())
        .post(`/file/upload-multiple/${testSubmissionId}`)
        .set('Authorization', `Bearer ${nodalOfficerToken}`)
        .attach('files', testFiles[0])
        .attach('files', testFiles[1])
        .attach('files', testFiles[2]);

      expect(uploadResponse.status).toBe(201);
      expect(uploadResponse.body.data).toHaveLength(3);
      expect(uploadResponse.body.count).toBe(3);

      // Clean up test files
      testFiles.forEach((filePath) => fs.unlinkSync(filePath));
    });

    it('should reject file upload for unauthorized user', async () => {
      const testFilePath = path.join(__dirname, 'test-file.txt');
      fs.writeFileSync(testFilePath, 'Test content');

      const uploadResponse = await request(app.getHttpServer())
        .post(`/file/upload/${testSubmissionId}`)
        .set('Authorization', `Bearer ${stateApproverToken}`)
        .attach('file', testFilePath);

      expect(uploadResponse.status).toBe(403);

      // Clean up test file
      fs.unlinkSync(testFilePath);
    });

    it('should reject large file upload', async () => {
      // Create a large test file (11MB)
      const largeFilePath = path.join(__dirname, 'large-file.txt');
      const largeContent = 'x'.repeat(11 * 1024 * 1024);
      fs.writeFileSync(largeFilePath, largeContent);

      const uploadResponse = await request(app.getHttpServer())
        .post(`/file/upload/${testSubmissionId}`)
        .set('Authorization', `Bearer ${nodalOfficerToken}`)
        .attach('file', largeFilePath);

      expect(uploadResponse.status).toBe(400);

      // Clean up test file
      fs.unlinkSync(largeFilePath);
    });

    it('should get file URL successfully', async () => {
      // First upload a file
      const testFilePath = path.join(__dirname, 'test-file.txt');
      fs.writeFileSync(testFilePath, 'Test content');

      const uploadResponse = await request(app.getHttpServer())
        .post(`/file/upload/${testSubmissionId}`)
        .set('Authorization', `Bearer ${nodalOfficerToken}`)
        .attach('file', testFilePath);

      const filePath = uploadResponse.body.data.filePath;

      // Get file URL
      const urlResponse = await request(app.getHttpServer())
        .get(`/file/url/${filePath}`)
        .set('Authorization', `Bearer ${nodalOfficerToken}`);

      expect(urlResponse.status).toBe(200);
      expect(urlResponse.body).toHaveProperty('url');

      // Clean up test file
      fs.unlinkSync(testFilePath);
    });

    it('should delete file successfully', async () => {
      // First upload a file
      const testFilePath = path.join(__dirname, 'test-file.txt');
      fs.writeFileSync(testFilePath, 'Test content');

      const uploadResponse = await request(app.getHttpServer())
        .post(`/file/upload/${testSubmissionId}`)
        .set('Authorization', `Bearer ${nodalOfficerToken}`)
        .attach('file', testFilePath);

      const filePath = uploadResponse.body.data.filePath;

      // Delete file
      const deleteResponse = await request(app.getHttpServer())
        .delete(`/file/${filePath}`)
        .set('Authorization', `Bearer ${nodalOfficerToken}`);

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.success).toBe(true);

      // Clean up test file
      fs.unlinkSync(testFilePath);
    });
  });

  describe('Complete Workflow with File Storage', () => {
    it('should complete the full workflow with file uploads', async () => {
      // Step 1: Create submission
      const createResponse = await request(app.getHttpServer())
        .post('/submission')
        .set('Authorization', `Bearer ${nodalOfficerToken}`)
        .send({
          submissionId: 'SUB-FILE-WORKFLOW-001',
          formData: {
            capexToGsdpRatio: 6.0,
            infrastructureInvestment: 1500,
            projectCompletionRate: 92,
            qualityIndex: 9.2,
            sustainabilityScore: 8.5,
            innovationIndex: 7.8,
          },
        });

      const submissionId = createResponse.body.id;

      // Step 2: Upload supporting documents
      const testFiles = [];
      for (let i = 0; i < 2; i++) {
        const testFilePath = path.join(__dirname, `workflow-file-${i}.txt`);
        fs.writeFileSync(testFilePath, `Workflow test file ${i}`);
        testFiles.push(testFilePath);
      }

      const uploadResponse = await request(app.getHttpServer())
        .post(`/file/upload-multiple/${submissionId}`)
        .set('Authorization', `Bearer ${nodalOfficerToken}`)
        .attach('files', testFiles[0])
        .attach('files', testFiles[1]);

      expect(uploadResponse.status).toBe(201);

      // Step 3: Forward to MoSPI
      const forwardResponse = await request(app.getHttpServer())
        .post(`/submission/forward-to-mospi/${submissionId}`)
        .set('Authorization', `Bearer ${stateApproverToken}`)
        .send({
          comment: 'Forwarding with supporting documents',
        });

      expect(forwardResponse.status).toBe(200);

      // Step 4: MoSPI Review
      const reviewResponse = await request(app.getHttpServer())
        .post(`/submission/${submissionId}/comment`)
        .set('Authorization', `Bearer ${mospiReviewerToken}`)
        .send({
          text: 'Review completed with file verification',
          type: 'comment',
        });

      expect(reviewResponse.status).toBe(201);

      // Step 5: MoSPI Approval
      const approveResponse = await request(app.getHttpServer())
        .post(`/submission/approve/${submissionId}`)
        .set('Authorization', `Bearer ${mospiApproverToken}`);

      expect(approveResponse.status).toBe(200);
      expect(approveResponse.body.status).toBe(SubmissionStatus.APPROVED);

      // Verify final score was calculated
      const finalScoreRepository = dataSource.getRepository(FinalScore);
      const finalScore = await finalScoreRepository.findOne({
        where: { submissionId },
      });

      expect(finalScore).toBeDefined();
      expect(finalScore.totalScore).toBeGreaterThan(0);

      // Clean up test files
      testFiles.forEach((filePath) => fs.unlinkSync(filePath));
    });
  });
});
