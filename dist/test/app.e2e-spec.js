"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const config_1 = require("@nestjs/config");
const request = require("supertest");
const typeorm_2 = require("typeorm");
const fs = require("fs");
const path = require("path");
const app_module_1 = require("../src/app.module");
const user_entity_1 = require("../src/entities/user.entity");
const submission_entity_1 = require("../src/entities/submission.entity");
const final_score_entity_1 = require("../src/entities/final-score.entity");
const audit_log_entity_1 = require("../src/entities/audit-log.entity");
describe('NIRI Workflow E2E Tests', () => {
    let app;
    let dataSource;
    let authToken;
    let nodalOfficerToken;
    let stateApproverToken;
    let mospiReviewerToken;
    let mospiApproverToken;
    beforeAll(async () => {
        const moduleFixture = await testing_1.Test.createTestingModule({
            imports: [
                config_1.ConfigModule.forRoot({
                    isGlobal: true,
                    envFilePath: '.env.test',
                }),
                typeorm_1.TypeOrmModule.forRoot({
                    type: 'postgres',
                    host: process.env.DB_HOST || 'localhost',
                    port: parseInt(process.env.DB_PORT) || 5432,
                    username: process.env.DB_USERNAME || 'test_user',
                    password: process.env.DB_PASSWORD || 'test_password',
                    database: process.env.DB_DATABASE || 'niri_test_db',
                    entities: [user_entity_1.User, submission_entity_1.Submission, final_score_entity_1.FinalScore, audit_log_entity_1.AuditLog],
                    synchronize: true,
                    dropSchema: true,
                }),
                app_module_1.AppModule,
            ],
        }).compile();
        app = moduleFixture.createNestApplication();
        dataSource = moduleFixture.get(typeorm_2.DataSource);
        await app.init();
    });
    afterAll(async () => {
        await app.close();
    });
    beforeEach(async () => {
        await dataSource.synchronize(true);
        await createTestUsers();
        await getAuthTokens();
    });
    async function createTestUsers() {
        const userRepository = dataSource.getRepository(user_entity_1.User);
        const users = [
            {
                email: 'nodal@test.com',
                password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K',
                firstName: 'Nodal',
                lastName: 'Officer',
                role: user_entity_1.UserRole.NODAL_OFFICER,
                stateUt: 'Maharashtra',
                isActive: true,
            },
            {
                email: 'state@test.com',
                password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K',
                firstName: 'State',
                lastName: 'Approver',
                role: user_entity_1.UserRole.STATE_APPROVER,
                stateUt: 'Maharashtra',
                isActive: true,
            },
            {
                email: 'mospi.reviewer@test.com',
                password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K',
                firstName: 'MoSPI',
                lastName: 'Reviewer',
                role: user_entity_1.UserRole.MOSPI_REVIEWER,
                stateUt: 'Central',
                isActive: true,
            },
            {
                email: 'mospi.approver@test.com',
                password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K',
                firstName: 'MoSPI',
                lastName: 'Approver',
                role: user_entity_1.UserRole.MOSPI_APPROVER,
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
        const responses = await Promise.all(loginRequests.map((loginData) => request(app.getHttpServer()).post('/auth/login').send(loginData)));
        nodalOfficerToken = responses[0].body.accessToken;
        stateApproverToken = responses[1].body.accessToken;
        mospiReviewerToken = responses[2].body.accessToken;
        mospiApproverToken = responses[3].body.accessToken;
    }
    describe('Complete 4-Tier Workflow', () => {
        it('should complete the full workflow: Create -> State Approve -> MoSPI Review -> MoSPI Approve', async () => {
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
            expect(createSubmissionResponse.body.status).toBe(submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE);
            expect(createSubmissionResponse.body.currentOwnerRole).toBe(user_entity_1.UserRole.STATE_APPROVER);
            const submissionId = createSubmissionResponse.body.id;
            const forwardResponse = await request(app.getHttpServer())
                .post(`/submission/forward-to-mospi/${submissionId}`)
                .set('Authorization', `Bearer ${stateApproverToken}`)
                .send({
                comment: 'Forwarding to MoSPI for review',
            });
            expect(forwardResponse.status).toBe(200);
            expect(forwardResponse.body.status).toBe(submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER);
            expect(forwardResponse.body.currentOwnerRole).toBe(user_entity_1.UserRole.MOSPI_REVIEWER);
            const commentResponse = await request(app.getHttpServer())
                .post(`/submission/${submissionId}/comment`)
                .set('Authorization', `Bearer ${mospiReviewerToken}`)
                .send({
                text: 'Review completed, ready for approval',
                type: 'comment',
            });
            expect(commentResponse.status).toBe(201);
            const approveResponse = await request(app.getHttpServer())
                .post(`/submission/approve/${submissionId}`)
                .set('Authorization', `Bearer ${mospiApproverToken}`);
            expect(approveResponse.status).toBe(200);
            expect(approveResponse.body.status).toBe(submission_entity_1.SubmissionStatus.APPROVED);
            expect(approveResponse.body.currentOwnerRole).toBe(user_entity_1.UserRole.NODAL_OFFICER);
            const finalScoreRepository = dataSource.getRepository(final_score_entity_1.FinalScore);
            const finalScore = await finalScoreRepository.findOne({
                where: { submissionId },
            });
            expect(finalScore).toBeDefined();
            expect(finalScore.totalScore).toBeGreaterThan(0);
        });
    });
    describe('Single Rejection Rule', () => {
        it('should enforce single rejection rule correctly', async () => {
            const createResponse = await request(app.getHttpServer())
                .post('/submission')
                .set('Authorization', `Bearer ${nodalOfficerToken}`)
                .send({
                submissionId: 'SUB-002',
                formData: { indicator1: 10 },
            });
            const submissionId = createResponse.body.id;
            await request(app.getHttpServer())
                .post(`/submission/forward-to-mospi/${submissionId}`)
                .set('Authorization', `Bearer ${stateApproverToken}`)
                .send({ comment: 'Forwarding' });
            const firstRejectResponse = await request(app.getHttpServer())
                .post(`/submission/final-reject/${submissionId}`)
                .set('Authorization', `Bearer ${mospiApproverToken}`)
                .send({ comment: 'First rejection' });
            expect(firstRejectResponse.status).toBe(200);
            expect(firstRejectResponse.body.status).toBe(submission_entity_1.SubmissionStatus.REJECTED);
            expect(firstRejectResponse.body.currentOwnerRole).toBe(user_entity_1.UserRole.STATE_APPROVER);
            const resubmitResponse = await request(app.getHttpServer())
                .post(`/submission/resubmit/${submissionId}`)
                .set('Authorization', `Bearer ${nodalOfficerToken}`)
                .send({ comment: 'Resubmitting with corrections' });
            expect(resubmitResponse.status).toBe(200);
            expect(resubmitResponse.body.status).toBe(submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE);
            expect(resubmitResponse.body.rejectionCount).toBe(1);
            await request(app.getHttpServer())
                .post(`/submission/forward-to-mospi/${submissionId}`)
                .set('Authorization', `Bearer ${stateApproverToken}`)
                .send({ comment: 'Forwarding again' });
            const secondRejectResponse = await request(app.getHttpServer())
                .post(`/submission/final-reject/${submissionId}`)
                .set('Authorization', `Bearer ${mospiApproverToken}`)
                .send({ comment: 'Final rejection' });
            expect(secondRejectResponse.status).toBe(200);
            expect(secondRejectResponse.body.status).toBe(submission_entity_1.SubmissionStatus.REJECTED_FINAL);
            expect(secondRejectResponse.body.currentOwnerRole).toBe(user_entity_1.UserRole.NODAL_OFFICER);
        });
    });
    describe('Role-Based Access Control', () => {
        it('should enforce role-based access correctly', async () => {
            const createResponse = await request(app.getHttpServer())
                .post('/submission')
                .set('Authorization', `Bearer ${nodalOfficerToken}`)
                .send({
                submissionId: 'SUB-003',
                formData: { indicator1: 10 },
            });
            const submissionId = createResponse.body.id;
            const unauthorizedForward = await request(app.getHttpServer())
                .post(`/submission/forward-to-mospi/${submissionId}`)
                .set('Authorization', `Bearer ${nodalOfficerToken}`)
                .send({ comment: 'Unauthorized' });
            expect(unauthorizedForward.status).toBe(403);
            const unauthorizedApprove = await request(app.getHttpServer())
                .post(`/submission/approve/${submissionId}`)
                .set('Authorization', `Bearer ${stateApproverToken}`);
            expect(unauthorizedApprove.status).toBe(403);
            const unauthorizedReviewerApprove = await request(app.getHttpServer())
                .post(`/submission/approve/${submissionId}`)
                .set('Authorization', `Bearer ${mospiReviewerToken}`);
            expect(unauthorizedReviewerApprove.status).toBe(403);
        });
    });
    describe('Dashboard and Reporting', () => {
        it('should provide role-specific dashboard data', async () => {
            await request(app.getHttpServer())
                .post('/submission')
                .set('Authorization', `Bearer ${nodalOfficerToken}`)
                .send({
                submissionId: 'SUB-004',
                formData: { indicator1: 10 },
            });
            const dashboardResponse = await request(app.getHttpServer())
                .get('/dashboard/summary')
                .set('Authorization', `Bearer ${nodalOfficerToken}`);
            expect(dashboardResponse.status).toBe(200);
            expect(dashboardResponse.body).toHaveProperty('pendingSubmissions');
            expect(dashboardResponse.body).toHaveProperty('totalSubmissions');
        });
        it('should provide ranking data', async () => {
            const rankingResponse = await request(app.getHttpServer())
                .get('/report/ranking')
                .set('Authorization', `Bearer ${mospiApproverToken}`);
            expect(rankingResponse.status).toBe(200);
            expect(Array.isArray(rankingResponse.body)).toBe(true);
        });
    });
    describe('File Storage Integration', () => {
        let testSubmissionId;
        beforeEach(async () => {
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
            fs.unlinkSync(testFilePath);
        });
        it('should upload multiple files successfully', async () => {
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
            fs.unlinkSync(testFilePath);
        });
        it('should reject large file upload', async () => {
            const largeFilePath = path.join(__dirname, 'large-file.txt');
            const largeContent = 'x'.repeat(11 * 1024 * 1024);
            fs.writeFileSync(largeFilePath, largeContent);
            const uploadResponse = await request(app.getHttpServer())
                .post(`/file/upload/${testSubmissionId}`)
                .set('Authorization', `Bearer ${nodalOfficerToken}`)
                .attach('file', largeFilePath);
            expect(uploadResponse.status).toBe(400);
            fs.unlinkSync(largeFilePath);
        });
        it('should get file URL successfully', async () => {
            const testFilePath = path.join(__dirname, 'test-file.txt');
            fs.writeFileSync(testFilePath, 'Test content');
            const uploadResponse = await request(app.getHttpServer())
                .post(`/file/upload/${testSubmissionId}`)
                .set('Authorization', `Bearer ${nodalOfficerToken}`)
                .attach('file', testFilePath);
            const filePath = uploadResponse.body.data.filePath;
            const urlResponse = await request(app.getHttpServer())
                .get(`/file/url/${filePath}`)
                .set('Authorization', `Bearer ${nodalOfficerToken}`);
            expect(urlResponse.status).toBe(200);
            expect(urlResponse.body).toHaveProperty('url');
            fs.unlinkSync(testFilePath);
        });
        it('should delete file successfully', async () => {
            const testFilePath = path.join(__dirname, 'test-file.txt');
            fs.writeFileSync(testFilePath, 'Test content');
            const uploadResponse = await request(app.getHttpServer())
                .post(`/file/upload/${testSubmissionId}`)
                .set('Authorization', `Bearer ${nodalOfficerToken}`)
                .attach('file', testFilePath);
            const filePath = uploadResponse.body.data.filePath;
            const deleteResponse = await request(app.getHttpServer())
                .delete(`/file/${filePath}`)
                .set('Authorization', `Bearer ${nodalOfficerToken}`);
            expect(deleteResponse.status).toBe(200);
            expect(deleteResponse.body.success).toBe(true);
            fs.unlinkSync(testFilePath);
        });
    });
    describe('Complete Workflow with File Storage', () => {
        it('should complete the full workflow with file uploads', async () => {
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
            const forwardResponse = await request(app.getHttpServer())
                .post(`/submission/forward-to-mospi/${submissionId}`)
                .set('Authorization', `Bearer ${stateApproverToken}`)
                .send({
                comment: 'Forwarding with supporting documents',
            });
            expect(forwardResponse.status).toBe(200);
            const reviewResponse = await request(app.getHttpServer())
                .post(`/submission/${submissionId}/comment`)
                .set('Authorization', `Bearer ${mospiReviewerToken}`)
                .send({
                text: 'Review completed with file verification',
                type: 'comment',
            });
            expect(reviewResponse.status).toBe(201);
            const approveResponse = await request(app.getHttpServer())
                .post(`/submission/approve/${submissionId}`)
                .set('Authorization', `Bearer ${mospiApproverToken}`);
            expect(approveResponse.status).toBe(200);
            expect(approveResponse.body.status).toBe(submission_entity_1.SubmissionStatus.APPROVED);
            const finalScoreRepository = dataSource.getRepository(final_score_entity_1.FinalScore);
            const finalScore = await finalScoreRepository.findOne({
                where: { submissionId },
            });
            expect(finalScore).toBeDefined();
            expect(finalScore.totalScore).toBeGreaterThan(0);
            testFiles.forEach((filePath) => fs.unlinkSync(filePath));
        });
    });
});
//# sourceMappingURL=app.e2e-spec.js.map