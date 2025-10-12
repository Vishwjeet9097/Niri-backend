"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const config_1 = require("@nestjs/config");
const request = require("supertest");
const typeorm_2 = require("typeorm");
const app_module_1 = require("../src/app.module");
const user_entity_1 = require("../src/entities/user.entity");
describe('User Management E2E Tests', () => {
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
                    entities: [user_entity_1.User],
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
            {
                email: 'nodal1@test.com',
                password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K',
                firstName: 'Nodal',
                lastName: 'Officer 1',
                role: user_entity_1.UserRole.NODAL_OFFICER,
                stateUt: 'Maharashtra',
                isActive: true,
            },
            {
                email: 'nodal2@test.com',
                password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K',
                firstName: 'Nodal',
                lastName: 'Officer 2',
                role: user_entity_1.UserRole.NODAL_OFFICER,
                stateUt: 'Karnataka',
                isActive: true,
            },
            {
                email: 'state2@test.com',
                password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K',
                firstName: 'State',
                lastName: 'Approver 2',
                role: user_entity_1.UserRole.STATE_APPROVER,
                stateUt: 'Karnataka',
                isActive: true,
            },
        ];
        await userRepository.save(users);
    }
    async function getAuthTokens() {
        const loginRequests = [
            { email: 'state@test.com', password: 'password123' },
            { email: 'mospi.reviewer@test.com', password: 'password123' },
            { email: 'mospi.approver@test.com', password: 'password123' },
        ];
        const responses = await Promise.all(loginRequests.map((loginData) => request(app.getHttpServer()).post('/auth/login').send(loginData)));
        authTokens = {
            stateApprover: responses[0].body.data.accessToken,
            mospiReviewer: responses[1].body.data.accessToken,
            mospiApprover: responses[2].body.data.accessToken,
        };
    }
    describe('GET /users', () => {
        it('should get all users with pagination', async () => {
            const response = await request(app.getHttpServer())
                .get('/users?page=1&limit=10')
                .set('Authorization', `Bearer ${authTokens.stateApprover}`);
            expect(response.status).toBe(200);
            expect(response.body.status).toBe(true);
            expect(response.body.data).toHaveProperty('users');
            expect(response.body.data).toHaveProperty('total');
            expect(Array.isArray(response.body.data.users)).toBe(true);
            expect(response.body.data.users.length).toBeGreaterThan(0);
        });
        it('should filter users by role', async () => {
            const response = await request(app.getHttpServer())
                .get('/users/by-role/NODAL_OFFICER')
                .set('Authorization', `Bearer ${authTokens.stateApprover}`);
            expect(response.status).toBe(200);
            expect(response.body.status).toBe(true);
            expect(response.body.data.every((user) => user.role === user_entity_1.UserRole.NODAL_OFFICER)).toBe(true);
        });
        it('should filter users by state', async () => {
            const response = await request(app.getHttpServer())
                .get('/users/by-state/Maharashtra')
                .set('Authorization', `Bearer ${authTokens.stateApprover}`);
            expect(response.status).toBe(200);
            expect(response.body.status).toBe(true);
            expect(response.body.data.every((user) => user.stateUt === 'Maharashtra')).toBe(true);
        });
        it('should reject request without authentication', async () => {
            const response = await request(app.getHttpServer()).get('/users');
            expect(response.status).toBe(401);
        });
    });
    describe('GET /users/:id', () => {
        let userId;
        beforeEach(async () => {
            const userRepository = dataSource.getRepository(user_entity_1.User);
            const user = await userRepository.findOne({
                where: { email: 'nodal1@test.com' },
            });
            userId = user.id;
        });
        it('should get specific user by ID', async () => {
            const response = await request(app.getHttpServer())
                .get(`/users/${userId}`)
                .set('Authorization', `Bearer ${authTokens.stateApprover}`);
            expect(response.status).toBe(200);
            expect(response.body.status).toBe(true);
            expect(response.body.data.id).toBe(userId);
            expect(response.body.data.email).toBe('nodal1@test.com');
        });
        it('should reject request for non-existent user', async () => {
            const response = await request(app.getHttpServer())
                .get('/users/non-existent-id')
                .set('Authorization', `Bearer ${authTokens.stateApprover}`);
            expect(response.status).toBe(404);
        });
        it('should reject request without authentication', async () => {
            const response = await request(app.getHttpServer()).get(`/users/${userId}`);
            expect(response.status).toBe(401);
        });
    });
    describe('PATCH /users/:id', () => {
        let userId;
        beforeEach(async () => {
            const userRepository = dataSource.getRepository(user_entity_1.User);
            const user = await userRepository.findOne({
                where: { email: 'nodal1@test.com' },
            });
            userId = user.id;
        });
        it('should update user successfully', async () => {
            const updateData = {
                firstName: 'Updated',
                lastName: 'Name',
                stateUt: 'Gujarat',
            };
            const response = await request(app.getHttpServer())
                .patch(`/users/${userId}`)
                .set('Authorization', `Bearer ${authTokens.stateApprover}`)
                .send(updateData);
            expect(response.status).toBe(200);
            expect(response.body.status).toBe(true);
            expect(response.body.data.firstName).toBe(updateData.firstName);
            expect(response.body.data.lastName).toBe(updateData.lastName);
            expect(response.body.data.stateUt).toBe(updateData.stateUt);
        });
        it('should reject update by unauthorized role', async () => {
            const updateData = {
                firstName: 'Unauthorized',
                lastName: 'Update',
            };
            const loginResponse = await request(app.getHttpServer()).post('/auth/login').send({
                email: 'nodal1@test.com',
                password: 'password123',
            });
            const response = await request(app.getHttpServer())
                .patch(`/users/${userId}`)
                .set('Authorization', `Bearer ${loginResponse.body.data.accessToken}`)
                .send(updateData);
            expect(response.status).toBe(403);
        });
        it('should reject update with invalid data', async () => {
            const updateData = {
                email: 'invalid-email',
            };
            const response = await request(app.getHttpServer())
                .patch(`/users/${userId}`)
                .set('Authorization', `Bearer ${authTokens.stateApprover}`)
                .send(updateData);
            expect(response.status).toBe(400);
        });
    });
    describe('DELETE /users/:id', () => {
        let userId;
        beforeEach(async () => {
            const userRepository = dataSource.getRepository(user_entity_1.User);
            const user = await userRepository.save({
                email: 'deletable@test.com',
                password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K',
                firstName: 'Deletable',
                lastName: 'User',
                role: user_entity_1.UserRole.NODAL_OFFICER,
                stateUt: 'Tamil Nadu',
                isActive: true,
            });
            userId = user.id;
        });
        it('should deactivate user successfully', async () => {
            const response = await request(app.getHttpServer())
                .delete(`/users/${userId}`)
                .set('Authorization', `Bearer ${authTokens.mospiApprover}`);
            expect(response.status).toBe(200);
            expect(response.body.status).toBe(true);
            expect(response.body.message).toBe('User deactivated successfully');
            const userRepository = dataSource.getRepository(user_entity_1.User);
            const user = await userRepository.findOne({ where: { id: userId } });
            expect(user.isActive).toBe(false);
        });
        it('should reject deletion by unauthorized role', async () => {
            const response = await request(app.getHttpServer())
                .delete(`/users/${userId}`)
                .set('Authorization', `Bearer ${authTokens.stateApprover}`);
            expect(response.status).toBe(403);
        });
        it('should reject deletion of non-existent user', async () => {
            const response = await request(app.getHttpServer())
                .delete('/users/non-existent-id')
                .set('Authorization', `Bearer ${authTokens.mospiApprover}`);
            expect(response.status).toBe(404);
        });
    });
    describe('Role-based Access Control', () => {
        it('should allow STATE_APPROVER to manage users', async () => {
            const response = await request(app.getHttpServer())
                .get('/users')
                .set('Authorization', `Bearer ${authTokens.stateApprover}`);
            expect(response.status).toBe(200);
        });
        it('should allow MOSPI_REVIEWER to manage users', async () => {
            const response = await request(app.getHttpServer())
                .get('/users')
                .set('Authorization', `Bearer ${authTokens.mospiReviewer}`);
            expect(response.status).toBe(200);
        });
        it('should allow MOSPI_APPROVER to manage users', async () => {
            const response = await request(app.getHttpServer())
                .get('/users')
                .set('Authorization', `Bearer ${authTokens.mospiApprover}`);
            expect(response.status).toBe(200);
        });
        it('should reject NODAL_OFFICER from managing users', async () => {
            const loginResponse = await request(app.getHttpServer()).post('/auth/login').send({
                email: 'nodal1@test.com',
                password: 'password123',
            });
            const response = await request(app.getHttpServer())
                .get('/users')
                .set('Authorization', `Bearer ${loginResponse.body.data.accessToken}`);
            expect(response.status).toBe(403);
        });
    });
    describe('State-based Filtering', () => {
        it('should filter users by state for STATE_APPROVER', async () => {
            const response = await request(app.getHttpServer())
                .get('/users')
                .set('Authorization', `Bearer ${authTokens.stateApprover}`);
            expect(response.status).toBe(200);
            const maharashtraUsers = response.body.data.users.filter((user) => user.stateUt === 'Maharashtra');
            expect(maharashtraUsers.length).toBeGreaterThan(0);
        });
        it('should show all users for MOSPI roles', async () => {
            const response = await request(app.getHttpServer())
                .get('/users')
                .set('Authorization', `Bearer ${authTokens.mospiApprover}`);
            expect(response.status).toBe(200);
            const allStates = [...new Set(response.body.data.users.map((user) => user.stateUt))];
            expect(allStates.length).toBeGreaterThan(1);
        });
    });
});
//# sourceMappingURL=user.e2e-spec.js.map