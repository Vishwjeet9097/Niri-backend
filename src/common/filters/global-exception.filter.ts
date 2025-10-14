import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal server error";
    let error = "Internal Server Error";

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === "string") {
        message = exceptionResponse;
        error = exceptionResponse;
      } else if (
        typeof exceptionResponse === "object" &&
        exceptionResponse !== null
      ) {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || responseObj.error || exception.message;
        error = responseObj.error || exception.name;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.name;
    }

    // Log the error
    this.logger.error(
      `Exception caught: ${error} - ${message}`,
      exception instanceof Error ? exception.stack : undefined
    );

    // Handle specific database errors
    if (message.includes("relation") && message.includes("does not exist")) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      message =
        "Database table not found. Please run database migration first.";
      error = "Database Schema Error";
    } else if (message.includes("connection") || message.includes("timeout")) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      message = "Database connection failed. Please try again later.";
      error = "Database Connection Error";
    } else if (
      message.includes("duplicate key") ||
      message.includes("unique constraint")
    ) {
      status = HttpStatus.CONFLICT;
      message = "Resource already exists. Please check your input.";
      error = "Conflict Error";
    } else if (
      message.includes("foreign key") ||
      message.includes("constraint")
    ) {
      status = HttpStatus.BAD_REQUEST;
      message = "Invalid reference. Please check your input data.";
      error = "Data Integrity Error";
    }

    // Create standardized error response
    const errorResponse = {
      status: false,
      data: null,
      message: message,
      error: error,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    };

    // Add stack trace in development mode
    if (process.env.NODE_ENV === "development") {
      (errorResponse as any).stack =
        exception instanceof Error ? exception.stack : undefined;
    }

    response.status(status).json(errorResponse);
  }
}
