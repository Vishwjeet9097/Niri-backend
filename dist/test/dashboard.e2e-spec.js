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
describe('Dashboard E2E Tests', () => {
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
        await createTestData();
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
    async function createTestData() {
        const submissionRepository = dataSource.getRepository(submission_entity_1.Submission);
        const finalScoreRepository = dataSource.getRepository(final_score_entity_1.FinalScore);
        const submissions = [
            {
                submissionId: 'SUB-001',
                stateUt: 'Maharashtra',
                status: submission_entity_1.SubmissionStatus.DRAFT,
                formData: { indicator1: 10 },
                currentOwnerRole: user_entity_1.UserRole.NODAL_OFFICER,
                createdBy: 'nodal@test.com',
            },
            {
                submissionId: 'SUB-002',
                stateUt: 'Maharashtra',
                status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE,
                formData: { indicator1: 15 },
                currentOwnerRole: user_entity_1.UserRole.STATE_APPROVER,
                createdBy: 'nodal@test.com',
            },
            {
                submissionId: 'SUB-003',
                stateUt: 'Maharashtra',
                status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
                formData: { indicator1: 20 },
                currentOwnerRole: user_entity_1.UserRole.MOSPI_REVIEWER,
                createdBy: 'nodal@test.com',
            },
            {
                submissionId: 'SUB-004',
                stateUt: 'Maharashtra',
                status: submission_entity_1.SubmissionStatus.APPROVED,
                formData: { indicator1: 25 },
                currentOwnerRole: user_entity_1.UserRole.NODAL_OFFICER,
                createdBy: 'nodal@test.com',
            },
            {
                submissionId: 'SUB-005',
                stateUt: 'Karnataka',
                status: submission_entity_1.SubmissionStatus.APPROVED,
                formData: { indicator1: 30 },
                currentOwnerRole: user_entity_1.UserRole.NODAL_OFFICER,
                createdBy: 'nodal@test.com',
            },
        ];
        const savedSubmissions = await submissionRepository.save(submissions);
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
            const nodalKpis = nodalResponse.body.data;
            const stateKpis = stateResponse.body.data;
            expect(nodalKpis).toHaveProperty('submissionMetrics');
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
            expect(responseTime).toBeLessThan(5000);
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
//# sourceMappingURL=dashboard.e2e-spec.js.map