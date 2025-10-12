"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("typeorm");
const app_module_1 = require("./app.module");
const response_interceptor_1 = require("./common/interceptors/response.interceptor");
async function bootstrap() {
    console.log('🔄 Starting NIRI Backend API...');
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: ['error', 'warn', 'log'],
    });
    const configService = app.get(config_1.ConfigService);
    app.useGlobalInterceptors(new response_interceptor_1.ResponseInterceptor());
    app.enableCors({
        origin: true,
        credentials: true,
    });
    console.log('🔍 Verifying database connection...');
    try {
        const dataSource = app.get(typeorm_1.DataSource);
        const connectionPromise = dataSource.query('SELECT 1 as test');
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Database connection timeout')), 10000));
        await Promise.race([connectionPromise, timeoutPromise]);
        console.log('✅ Database connection verified successfully');
        const tables = await dataSource.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'submissions', 'audit_logs', 'final_scores')
    `);
        console.log(`📊 Found ${tables.length} required tables in database`);
        if (tables.length < 4) {
            console.warn('⚠️  Warning: Not all required tables found. Run migrations if needed.');
        }
    }
    catch (error) {
        console.error('❌ Database connection failed:', error.message);
        console.error('🛑 Application startup aborted - database not ready');
        process.exit(1);
    }
    const port = configService.get('PORT') || 3000;
    console.log(`🌐 Starting HTTP server on port ${port}...`);
    await app.listen(port);
    console.log(`🚀 NIRI Backend API is running on port ${port}`);
    console.log(`📡 Health check available at: http://localhost:${port}/health`);
    console.log(`📚 API Documentation at: http://localhost:${port}/api`);
}
bootstrap().catch((error) => {
    console.error('💥 Application startup failed:', error);
    process.exit(1);
});
//# sourceMappingURL=main.js.map