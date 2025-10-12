"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const config_1 = require("@nestjs/config");
const request = require("supertest");
const typeorm_2 = require("typeorm");
const app_module_1 = require("../src/app.module");
const user_entity_1 = require("../src/entities/user.entity");
const submission_entity_1 = require("../src/entities/submission.entity");
const final_score_entity_1 = require("../src/entities/final-score.entity");
describe('Submission E2E Tests', () => {
    let app;
    let dataSource;
    let authTokens;
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
                    entities: [user_entity_1.User, submission_entity_1.Submission, final_score_entity_1.FinalScore],
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
        authTokens = {
            nodalOfficer: responses[0].body.data.accessToken,
            stateApprover: responses[1].body.data.accessToken,
            mospiReviewer: responses[2].body.data.accessToken,
            mospiApprover: responses[3].body.data.accessToken,
        };
    }
    describe('POST /submission', () => {
        it('should create submission successfully', async () => {
            const submissionData = {
                submissionId: 'SUB-001',
                formData: {
                    capexToGsdpRatio: 5.5,
                    infrastructureInvestment: 1000,
                    projectCompletionRate: 85,
                    qualityIndex: 8.5,
                    sustainabilityScore: 7.5,
                    innovationIndex: 6.5,
                },
            };
            const response = await request(app.getHttpServer())
                .post('/submission')
                .set('Authorization', `Bearer ${authTokens.nodalOfficer}`)
                .send(submissionData);
            expect(response.status).toBe(201);
            expect(response.body.status).toBe(true);
            expect(response.body.data).toHaveProperty('id');
            expect(response.body.data.submissionId).toBe(submissionData.submissionId);
            expect(response.body.data.status).toBe(submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE);
            expect(response.body.data.currentOwnerRole).toBe(user_entity_1.UserRole.STATE_APPROVER);
        });
        it('should reject submission without authentication', async () => {
            const submissionData = {
                submissionId: 'SUB-002',
                formData: { indicator1: 10 },
            };
            const response = await request(app.getHttpServer()).post('/submission').send(submissionData);
            expect(response.status).toBe(401);
        });
        it('should reject submission with invalid data', async () => {
            const submissionData = {
                submissionId: '',
                formData: {},
            };
            const response = await request(app.getHttpServer())
                .post('/submission')
                .set('Authorization', `Bearer ${authTokens.nodalOfficer}`)
                .send(submissionData);
            expect(response.status).toBe(400);
        });
    });
    describe('GET /submission', () => {
        beforeEach(async () => {
            const submissionRepository = dataSource.getRepository(submission_entity_1.Submission);
            await submissionRepository.save([
                {
                    submissionId: 'SUB-001',
                    stateUt: 'Maharashtra',
                    status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE,
                    formData: { indicator1: 10 },
                    currentOwnerRole: user_entity_1.UserRole.STATE_APPROVER,
                    createdBy: 'nodal@test.com',
                },
                {
                    submissionId: 'SUB-002',
                    stateUt: 'Maharashtra',
                    status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
                    formData: { indicator1: 15 },
                    currentOwnerRole: user_entity_1.UserRole.MOSPI_REVIEWER,
                    createdBy: 'nodal@test.com',
                },
            ]);
        });
        it('should get submissions list with pagination', async () => {
            const response = await request(app.getHttpServer())
                .get('/submission?page=1&limit=10')
                .set('Authorization', `Bearer ${authTokens.nodalOfficer}`);
            expect(response.status).toBe(200);
            expect(response.body.status).toBe(true);
            expect(response.body.data).toHaveProperty('submissions');
            expect(response.body.data).toHaveProperty('total');
            expect(Array.isArray(response.body.data.submissions)).toBe(true);
        });
        it('should filter submissions by status', async () => {
            const response = await request(app.getHttpServer())
                .get('/submission?status=SUBMITTED_TO_STATE')
                .set('Authorization', `Bearer ${authTokens.nodalOfficer}`);
            expect(response.status).toBe(200);
            expect(response.body.data.submissions.every((sub) => sub.status === submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE)).toBe(true);
        });
    });
    describe('GET /submission/:id', () => {
        let submissionId;
        beforeEach(async () => {
            const submissionRepository = dataSource.getRepository(submission_entity_1.Submission);
            const submission = await submissionRepository.save({
                submissionId: 'SUB-003',
                stateUt: 'Maharashtra',
                status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE,
                formData: { indicator1: 20 },
                currentOwnerRole: user_entity_1.UserRole.STATE_APPROVER,
                createdBy: 'nodal@test.com',
            });
            submissionId = submission.id;
        });
        it('should get specific submission', async () => {
            const response = await request(app.getHttpServer())
                .get(`/submission/${submissionId}`)
                .set('Authorization', `Bearer ${authTokens.nodalOfficer}`);
            expect(response.status).toBe(200);
            expect(response.body.status).toBe(true);
            expect(response.body.data.id).toBe(submissionId);
            expect(response.body.data.submissionId).toBe('SUB-003');
        });
        it('should reject request for non-existent submission', async () => {
            const response = await request(app.getHttpServer())
                .get('/submission/non-existent-id')
                .set('Authorization', `Bearer ${authTokens.nodalOfficer}`);
            expect(response.status).toBe(404);
        });
    });
    describe('POST /submission/forward-to-mospi/:id', () => {
        let submissionId;
        beforeEach(async () => {
            const submissionRepository = dataSource.getRepository(submission_entity_1.Submission);
            const submission = await submissionRepository.save({
                submissionId: 'SUB-004',
                stateUt: 'Maharashtra',
                status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE,
                formData: { indicator1: 25 },
                currentOwnerRole: user_entity_1.UserRole.STATE_APPROVER,
                createdBy: 'nodal@test.com',
            });
            submissionId = submission.id;
        });
        it('should forward submission to MoSPI successfully', async () => {
            const response = await request(app.getHttpServer())
                .post(`/submission/forward-to-mospi/${submissionId}`)
                .set('Authorization', `Bearer ${authTokens.stateApprover}`)
                .send({ comment: 'Forwarding to MoSPI for review' });
            expect(response.status).toBe(200);
            expect(response.body.status).toBe(true);
            expect(response.body.data.status).toBe(submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER);
            expect(response.body.data.currentOwnerRole).toBe(user_entity_1.UserRole.MOSPI_REVIEWER);
        });
        it('should reject forwarding by unauthorized role', async () => {
            const response = await request(app.getHttpServer())
                .post(`/submission/forward-to-mospi/${submissionId}`)
                .set('Authorization', `Bearer ${authTokens.nodalOfficer}`)
                .send({ comment: 'Unauthorized forwarding' });
            expect(response.status).toBe(403);
        });
        it('should reject forwarding with wrong status', async () => {
            const submissionRepository = dataSource.getRepository(submission_entity_1.Submission);
            await submissionRepository.update(submissionId, {
                status: submission_entity_1.SubmissionStatus.APPROVED,
            });
            const response = await request(app.getHttpServer())
                .post(`/submission/forward-to-mospi/${submissionId}`)
                .set('Authorization', `Bearer ${authTokens.stateApprover}`)
                .send({ comment: 'Forwarding approved submission' });
            expect(response.status).toBe(400);
        });
    });
    describe('POST /submission/state-reject/:id', () => {
        let submissionId;
        beforeEach(async () => {
            const submissionRepository = dataSource.getRepository(submission_entity_1.Submission);
            const submission = await submissionRepository.save({
                submissionId: 'SUB-005',
                stateUt: 'Maharashtra',
                status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE,
                formData: { indicator1: 30 },
                currentOwnerRole: user_entity_1.UserRole.STATE_APPROVER,
                createdBy: 'nodal@test.com',
            });
            submissionId = submission.id;
        });
        it('should reject submission at state level', async () => {
            const response = await request(app.getHttpServer())
                .post(`/submission/state-reject/${submissionId}`)
                .set('Authorization', `Bearer ${authTokens.stateApprover}`)
                .send({ comment: 'Rejected due to incomplete data' });
            expect(response.status).toBe(200);
            expect(response.body.status).toBe(true);
            expect(response.body.data.status).toBe(submission_entity_1.SubmissionStatus.REJECTED);
            expect(response.body.data.currentOwnerRole).toBe(user_entity_1.UserRole.NODAL_OFFICER);
        });
        it('should require comment for rejection', async () => {
            const response = await request(app.getHttpServer())
                .post(`/submission/state-reject/${submissionId}`)
                .set('Authorization', `Bearer ${authTokens.stateApprover}`)
                .send({});
            expect(response.status).toBe(400);
        });
    });
    describe('POST /submission/approve/:id', () => {
        let submissionId;
        beforeEach(async () => {
            const submissionRepository = dataSource.getRepository(submission_entity_1.Submission);
            const submission = await submissionRepository.save({
                submissionId: 'SUB-006',
                stateUt: 'Maharashtra',
                status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
                formData: {
                    capexToGsdpRatio: 6.0,
                    infrastructureInvestment: 1500,
                    projectCompletionRate: 92,
                    qualityIndex: 9.2,
                    sustainabilityScore: 8.5,
                    innovationIndex: 7.8,
                },
                currentOwnerRole: user_entity_1.UserRole.MOSPI_APPROVER,
                createdBy: 'nodal@test.com',
            });
            submissionId = submission.id;
        });
        it('should approve submission and calculate score', async () => {
            const response = await request(app.getHttpServer())
                .post(`/submission/approve/${submissionId}`)
                .set('Authorization', `Bearer ${authTokens.mospiApprover}`);
            expect(response.status).toBe(200);
            expect(response.body.status).toBe(true);
            expect(response.body.data.status).toBe(submission_entity_1.SubmissionStatus.APPROVED);
            expect(response.body.data.currentOwnerRole).toBe(user_entity_1.UserRole.NODAL_OFFICER);
            const finalScoreRepository = dataSource.getRepository(final_score_entity_1.FinalScore);
            const finalScore = await finalScoreRepository.findOne({
                where: { submissionId },
            });
            expect(finalScore).toBeDefined();
            expect(finalScore.totalScore).toBeGreaterThan(0);
        });
        it('should reject approval by unauthorized role', async () => {
            const response = await request(app.getHttpServer())
                .post(`/submission/approve/${submissionId}`)
                .set('Authorization', `Bearer ${authTokens.stateApprover}`);
            expect(response.status).toBe(403);
        });
    });
    describe('POST /submission/final-reject/:id', () => {
        let submissionId;
        beforeEach(async () => {
            const submissionRepository = dataSource.getRepository(submission_entity_1.Submission);
            const submission = await submissionRepository.save({
                submissionId: 'SUB-007',
                stateUt: 'Maharashtra',
                status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
                formData: { indicator1: 35 },
                currentOwnerRole: user_entity_1.UserRole.MOSPI_APPROVER,
                createdBy: 'nodal@test.com',
            });
            submissionId = submission.id;
        });
        it('should reject submission at MoSPI level', async () => {
            const response = await request(app.getHttpServer())
                .post(`/submission/final-reject/${submissionId}`)
                .set('Authorization', `Bearer ${authTokens.mospiApprover}`)
                .send({ comment: 'Final rejection due to quality issues' });
            expect(response.status).toBe(200);
            expect(response.body.status).toBe(true);
            expect(response.body.data.status).toBe(submission_entity_1.SubmissionStatus.REJECTED);
            expect(response.body.data.currentOwnerRole).toBe(user_entity_1.UserRole.STATE_APPROVER);
        });
        it('should enforce single rejection rule', async () => {
            await request(app.getHttpServer())
                .post(`/submission/final-reject/${submissionId}`)
                .set('Authorization', `Bearer ${authTokens.mospiApprover}`)
                .send({ comment: 'First rejection' });
            await request(app.getHttpServer())
                .post(`/submission/resubmit/${submissionId}`)
                .set('Authorization', `Bearer ${authTokens.nodalOfficer}`)
                .send({ comment: 'Resubmitting' });
            await request(app.getHttpServer())
                .post(`/submission/forward-to-mospi/${submissionId}`)
                .set('Authorization', `Bearer ${authTokens.stateApprover}`)
                .send({ comment: 'Forwarding again' });
            const response = await request(app.getHttpServer())
                .post(`/submission/final-reject/${submissionId}`)
                .set('Authorization', `Bearer ${authTokens.mospiApprover}`)
                .send({ comment: 'Final rejection' });
            expect(response.status).toBe(200);
            expect(response.body.data.status).toBe(submission_entity_1.SubmissionStatus.REJECTED_FINAL);
        });
    });
    describe('POST /submission/resubmit/:id', () => {
        let submissionId;
        beforeEach(async () => {
            const submissionRepository = dataSource.getRepository(submission_entity_1.Submission);
            const submission = await submissionRepository.save({
                submissionId: 'SUB-008',
                stateUt: 'Maharashtra',
                status: submission_entity_1.SubmissionStatus.REJECTED,
                formData: { indicator1: 40 },
                currentOwnerRole: user_entity_1.UserRole.NODAL_OFFICER,
                createdBy: 'nodal@test.com',
                rejectionCount: 0,
            });
            submissionId = submission.id;
        });
        it('should resubmit rejected submission', async () => {
            const response = await request(app.getHttpServer())
                .post(`/submission/resubmit/${submissionId}`)
                .set('Authorization', `Bearer ${authTokens.nodalOfficer}`)
                .send({ comment: 'Resubmitting with corrections' });
            expect(response.status).toBe(200);
            expect(response.body.status).toBe(true);
            expect(response.body.data.status).toBe(submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE);
            expect(response.body.data.rejectionCount).toBe(1);
        });
        it('should reject resubmission by unauthorized role', async () => {
            const response = await request(app.getHttpServer())
                .post(`/submission/resubmit/${submissionId}`)
                .set('Authorization', `Bearer ${authTokens.stateApprover}`)
                .send({ comment: 'Unauthorized resubmission' });
            expect(response.status).toBe(403);
        });
    });
    describe('POST /submission/:id/comment', () => {
        let submissionId;
        beforeEach(async () => {
            const submissionRepository = dataSource.getRepository(submission_entity_1.Submission);
            const submission = await submissionRepository.save({
                submissionId: 'SUB-009',
                stateUt: 'Maharashtra',
                status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
                formData: { indicator1: 45 },
                currentOwnerRole: user_entity_1.UserRole.MOSPI_REVIEWER,
                createdBy: 'nodal@test.com',
            });
            submissionId = submission.id;
        });
        it('should add comment to submission', async () => {
            const commentData = {
                text: 'This is a review comment',
                type: 'comment',
            };
            const response = await request(app.getHttpServer())
                .post(`/submission/${submissionId}/comment`)
                .set('Authorization', `Bearer ${authTokens.mospiReviewer}`)
                .send(commentData);
            expect(response.status).toBe(201);
            expect(response.body.status).toBe(true);
            expect(response.body.data).toHaveProperty('id');
            expect(response.body.data.text).toBe(commentData.text);
        });
        it('should reject comment without authentication', async () => {
            const commentData = {
                text: 'Unauthorized comment',
                type: 'comment',
            };
            const response = await request(app.getHttpServer())
                .post(`/submission/${submissionId}/comment`)
                .send(commentData);
            expect(response.status).toBe(401);
        });
    });
});
//# sourceMappingURL=submission.e2e-spec.js.map