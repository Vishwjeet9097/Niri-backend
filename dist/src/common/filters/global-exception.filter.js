"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var GlobalExceptionFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
let GlobalExceptionFilter = GlobalExceptionFilter_1 = class GlobalExceptionFilter {
    constructor() {
        this.logger = new common_1.Logger(GlobalExceptionFilter_1.name);
    }
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        let status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        let message = "Internal server error";
        let error = "Internal Server Error";
        if (exception instanceof common_1.HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();
            if (typeof exceptionResponse === "string") {
                message = exceptionResponse;
                error = exceptionResponse;
            }
            else if (typeof exceptionResponse === "object" &&
                exceptionResponse !== null) {
                const responseObj = exceptionResponse;
                message = responseObj.message || responseObj.error || exception.message;
                error = responseObj.error || exception.name;
            }
        }
        else if (exception instanceof Error) {
            message = exception.message;
            error = exception.name;
        }
        this.logger.error(`Exception caught: ${error} - ${message}`, exception instanceof Error ? exception.stack : undefined);
        if (message.includes("relation") && message.includes("does not exist")) {
            status = common_1.HttpStatus.SERVICE_UNAVAILABLE;
            message =
                "Database table not found. Please run database migration first.";
            error = "Database Schema Error";
        }
        else if (message.includes("connection") || message.includes("timeout")) {
            status = common_1.HttpStatus.SERVICE_UNAVAILABLE;
            message = "Database connection failed. Please try again later.";
            error = "Database Connection Error";
        }
        else if (message.includes("duplicate key") ||
            message.includes("unique constraint")) {
            status = common_1.HttpStatus.CONFLICT;
            message = "Resource already exists. Please check your input.";
            error = "Conflict Error";
        }
        else if (message.includes("foreign key") ||
            message.includes("constraint")) {
            status = common_1.HttpStatus.BAD_REQUEST;
            message = "Invalid reference. Please check your input data.";
            error = "Data Integrity Error";
        }
        const errorResponse = {
            status: false,
            data: null,
            message: message,
            error: error,
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method,
        };
        if (process.env.NODE_ENV === "development") {
            errorResponse.stack =
                exception instanceof Error ? exception.stack : undefined;
        }
        response.status(status).json(errorResponse);
    }
};
exports.GlobalExceptionFilter = GlobalExceptionFilter;
exports.GlobalExceptionFilter = GlobalExceptionFilter = GlobalExceptionFilter_1 = __decorate([
    (0, common_1.Catch)()
], GlobalExceptionFilter);
//# sourceMappingURL=global-exception.filter.js.map