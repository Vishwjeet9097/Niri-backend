import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";
import { AppModule } from "./app.module";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";

async function bootstrap() {
  console.log("🔄 Starting NIRI Backend API...");

  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log", 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);

  // Global validation pipe - DISABLED for multiple status support
  // app.useGlobalPipes(
  //   new ValidationPipe({
  //     whitelist: true,
  //     forbidNonWhitelisted: false, // Changed to false to allow comma-separated values
  //     transform: true,
  //   }),
  // );

  // Global response interceptor
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // 🔥 CRITICAL: Database Connection Verification Before HTTP Server Start
  console.log("🔍 Verifying database connection...");

  try {
    const dataSource = app.get(DataSource);

    // Test database connection with timeout
    const connectionPromise = dataSource.query("SELECT 1 as test");
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Database connection timeout")), 10000)
    );

    await Promise.race([connectionPromise, timeoutPromise]);

    console.log("✅ Database connection verified successfully");

    // Additional verification: Check if tables exist
    const tables = await dataSource.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'submissions', 'audit_logs', 'final_scores')
    `);

    console.log(`📊 Found ${tables.length} required tables in database`);

    if (tables.length < 4) {
      console.warn(
        "⚠️  Warning: Not all required tables found. Run migrations if needed."
      );
    }
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    console.error("🛑 Application startup aborted - database not ready");
    process.exit(1);
  }

  const port = configService.get("PORT") || 3000;

  console.log(`🌐 Starting HTTP server on port ${port}...`);
  await app.listen(port);

  console.log(`🚀 NIRI Backend API is running on port ${port}`);
  console.log(`📡 Health check available at: http://localhost:${port}/health`);
  console.log(`📚 API Documentation at: http://localhost:${port}/api`);
}

bootstrap().catch((error) => {
  console.error("💥 Application startup failed:", error);
  process.exit(1);
});
