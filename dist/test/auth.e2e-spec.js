"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const config_1 = require("@nestjs/config");
const request = require("supertest");
const typeorm_2 = require("typeorm");
const app_module_1 = require("../src/app.module");
const user_entity_1 = require("../src/entities/user.entity");
describe('Authentication E2E Tests', () => {
    let app;
    let dataSource;
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
    });
    describe('POST /auth/register', () => {
        it('should register a new user successfully', async () => {
            const userData = {
                email: 'test@example.com',
                password: 'password123',
                firstName: 'Test',
                lastName: 'User',
                role: user_entity_1.UserRole.NODAL_OFFICER,
                stateUt: 'Maharashtra',
            };
            const response = await request(app.getHttpServer()).post('/auth/register').send(userData);
            expect(response.status).toBe(201);
            expect(response.body.status).toBe(true);
            expect(response.body.data).toHaveProperty('user');
            expect(response.body.data).toHaveProperty('accessToken');
            expect(response.body.data.user.email).toBe(userData.email);
            expect(response.body.data.user.role).toBe(userData.role);
        });
        it('should reject registration with invalid email', async () => {
            const userData = {
                email: 'invalid-email',
                password: 'password123',
                firstName: 'Test',
                lastName: 'User',
                role: user_entity_1.UserRole.NODAL_OFFICER,
                stateUt: 'Maharashtra',
            };
            const response = await request(app.getHttpServer()).post('/auth/register').send(userData);
            expect(response.status).toBe(400);
            expect(response.body.status).toBe(false);
        });
        it('should reject registration with duplicate email', async () => {
            const userData = {
                email: 'duplicate@example.com',
                password: 'password123',
                firstName: 'Test',
                lastName: 'User',
                role: user_entity_1.UserRole.NODAL_OFFICER,
                stateUt: 'Maharashtra',
            };
            await request(app.getHttpServer()).post('/auth/register').send(userData);
            const response = await request(app.getHttpServer()).post('/auth/register').send(userData);
            expect(response.status).toBe(409);
            expect(response.body.status).toBe(false);
        });
        it('should register users with all roles', async () => {
            const roles = [
                user_entity_1.UserRole.NODAL_OFFICER,
                user_entity_1.UserRole.STATE_APPROVER,
                user_entity_1.UserRole.MOSPI_REVIEWER,
                user_entity_1.UserRole.MOSPI_APPROVER,
            ];
            for (let i = 0; i < roles.length; i++) {
                const userData = {
                    email: `test${i}@example.com`,
                    password: 'password123',
                    firstName: 'Test',
                    lastName: 'User',
                    role: roles[i],
                    stateUt: 'Maharashtra',
                };
                const response = await request(app.getHttpServer()).post('/auth/register').send(userData);
                expect(response.status).toBe(201);
                expect(response.body.data.user.role).toBe(roles[i]);
            }
        });
    });
    describe('POST /auth/login', () => {
        beforeEach(async () => {
            const userRepository = dataSource.getRepository(user_entity_1.User);
            await userRepository.save({
                email: 'login@test.com',
                password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K',
                firstName: 'Login',
                lastName: 'Test',
                role: user_entity_1.UserRole.NODAL_OFFICER,
                stateUt: 'Maharashtra',
                isActive: true,
            });
        });
        it('should login with valid credentials', async () => {
            const loginData = {
                email: 'login@test.com',
                password: 'password123',
            };
            const response = await request(app.getHttpServer()).post('/auth/login').send(loginData);
            expect(response.status).toBe(200);
            expect(response.body.status).toBe(true);
            expect(response.body.data).toHaveProperty('user');
            expect(response.body.data).toHaveProperty('accessToken');
            expect(response.body.data.user.email).toBe(loginData.email);
        });
        it('should reject login with invalid email', async () => {
            const loginData = {
                email: 'nonexistent@test.com',
                password: 'password123',
            };
            const response = await request(app.getHttpServer()).post('/auth/login').send(loginData);
            expect(response.status).toBe(401);
            expect(response.body.status).toBe(false);
        });
        it('should reject login with invalid password', async () => {
            const loginData = {
                email: 'login@test.com',
                password: 'wrongpassword',
            };
            const response = await request(app.getHttpServer()).post('/auth/login').send(loginData);
            expect(response.status).toBe(401);
            expect(response.body.status).toBe(false);
        });
        it('should reject login with inactive user', async () => {
            const userRepository = dataSource.getRepository(user_entity_1.User);
            await userRepository.save({
                email: 'inactive@test.com',
                password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K',
                firstName: 'Inactive',
                lastName: 'User',
                role: user_entity_1.UserRole.NODAL_OFFICER,
                stateUt: 'Maharashtra',
                isActive: false,
            });
            const loginData = {
                email: 'inactive@test.com',
                password: 'password123',
            };
            const response = await request(app.getHttpServer()).post('/auth/login').send(loginData);
            expect(response.status).toBe(401);
            expect(response.body.status).toBe(false);
        });
    });
    describe('GET /auth/profile', () => {
        let authToken;
        beforeEach(async () => {
            const userRepository = dataSource.getRepository(user_entity_1.User);
            await userRepository.save({
                email: 'profile@test.com',
                password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K',
                firstName: 'Profile',
                lastName: 'Test',
                role: user_entity_1.UserRole.NODAL_OFFICER,
                stateUt: 'Maharashtra',
                isActive: true,
            });
            const loginResponse = await request(app.getHttpServer()).post('/auth/login').send({
                email: 'profile@test.com',
                password: 'password123',
            });
            authToken = loginResponse.body.data.accessToken;
        });
        it('should get user profile with valid token', async () => {
            const response = await request(app.getHttpServer())
                .get('/auth/profile')
                .set('Authorization', `Bearer ${authToken}`);
            expect(response.status).toBe(200);
            expect(response.body.status).toBe(true);
            expect(response.body.data).toHaveProperty('id');
            expect(response.body.data).toHaveProperty('email');
            expect(response.body.data).toHaveProperty('role');
            expect(response.body.data.email).toBe('profile@test.com');
        });
        it('should reject profile request without token', async () => {
            const response = await request(app.getHttpServer()).get('/auth/profile');
            expect(response.status).toBe(401);
        });
        it('should reject profile request with invalid token', async () => {
            const response = await request(app.getHttpServer())
                .get('/auth/profile')
                .set('Authorization', 'Bearer invalid-token');
            expect(response.status).toBe(401);
        });
    });
    describe('PUT /auth/change-password', () => {
        let authToken;
        beforeEach(async () => {
            const userRepository = dataSource.getRepository(user_entity_1.User);
            await userRepository.save({
                email: 'password@test.com',
                password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K',
                firstName: 'Password',
                lastName: 'Test',
                role: user_entity_1.UserRole.NODAL_OFFICER,
                stateUt: 'Maharashtra',
                isActive: true,
            });
            const loginResponse = await request(app.getHttpServer()).post('/auth/login').send({
                email: 'password@test.com',
                password: 'password123',
            });
            authToken = loginResponse.body.data.accessToken;
        });
        it('should change password with valid current password', async () => {
            const changePasswordData = {
                currentPassword: 'password123',
                newPassword: 'newpassword123',
            };
            const response = await request(app.getHttpServer())
                .put('/auth/change-password')
                .set('Authorization', `Bearer ${authToken}`)
                .send(changePasswordData);
            expect(response.status).toBe(200);
            expect(response.body.status).toBe(true);
            expect(response.body.message).toBe('Password changed successfully');
        });
        it('should reject password change with wrong current password', async () => {
            const changePasswordData = {
                currentPassword: 'wrongpassword',
                newPassword: 'newpassword123',
            };
            const response = await request(app.getHttpServer())
                .put('/auth/change-password')
                .set('Authorization', `Bearer ${authToken}`)
                .send(changePasswordData);
            expect(response.status).toBe(400);
            expect(response.body.status).toBe(false);
        });
        it('should reject password change without token', async () => {
            const changePasswordData = {
                currentPassword: 'password123',
                newPassword: 'newpassword123',
            };
            const response = await request(app.getHttpServer())
                .put('/auth/change-password')
                .send(changePasswordData);
            expect(response.status).toBe(401);
        });
    });
});
//# sourceMappingURL=auth.e2e-spec.js.map