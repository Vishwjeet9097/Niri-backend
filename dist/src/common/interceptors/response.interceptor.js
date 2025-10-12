"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseInterceptor = void 0;
const common_1 = require("@nestjs/common");
const operators_1 = require("rxjs/operators");
let ResponseInterceptor = class ResponseInterceptor {
    intercept(context, next) {
        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();
        return next.handle().pipe((0, operators_1.map)((data) => {
            if (response.statusCode >= 400) {
                return data;
            }
            if (data && typeof data === 'object' && 'status' in data && 'data' in data) {
                return data;
            }
            const url = request.url;
            if (url.includes('/submission') &&
                request.method === 'POST' &&
                !url.includes('/submit-to-state') &&
                !url.includes('/forward-to-mospi') &&
                !url.includes('/state-reject') &&
                !url.includes('/final-reject') &&
                !url.includes('/approve') &&
                !url.includes('/resubmit')) {
                return data;
            }
            return {
                status: true,
                data: data,
                message: this.getMessageFromContext(context),
                timestamp: new Date().toISOString(),
            };
        }));
    }
    getMessageFromContext(context) {
        const request = context.switchToHttp().getRequest();
        const method = request.method;
        const url = request.url;
        if (url.includes('/auth/login')) {
            return 'Login successful';
        }
        else if (url.includes('/auth/register')) {
            return 'User registered successfully';
        }
        else if (url.includes('/submission') && method === 'POST') {
            return 'Submission created successfully';
        }
        else if (url.includes('/submission') && method === 'PATCH') {
            return 'Submission updated successfully';
        }
        else if (url.includes('/submission') && method === 'GET') {
            return 'Submission retrieved successfully';
        }
        else if (url.includes('/submit-to-state')) {
            return 'Submission submitted to state successfully';
        }
        else if (url.includes('/forward-to-mospi')) {
            return 'Submission forwarded to MoSPI successfully';
        }
        else if (url.includes('/state-reject')) {
            return 'Submission rejected by state successfully';
        }
        else if (url.includes('/final-reject')) {
            return 'Submission rejected by MoSPI successfully';
        }
        else if (url.includes('/approve')) {
            return 'Submission approved successfully';
        }
        else if (url.includes('/resubmit')) {
            return 'Submission resubmitted successfully';
        }
        else if (url.includes('/dashboard')) {
            return 'Dashboard data retrieved successfully';
        }
        else if (url.includes('/report')) {
            return 'Report data retrieved successfully';
        }
        else if (url.includes('/file/upload')) {
            return 'File uploaded successfully';
        }
        else if (url.includes('/file') && method === 'DELETE') {
            return 'File deleted successfully';
        }
        else if (url.includes('/users') && method === 'GET') {
            return 'Users retrieved successfully';
        }
        else if (url.includes('/audit')) {
            return 'Audit data retrieved successfully';
        }
        else if (url.includes('/health')) {
            return 'Health check successful';
        }
        return 'Request processed successfully';
    }
};
exports.ResponseInterceptor = ResponseInterceptor;
exports.ResponseInterceptor = ResponseInterceptor = __decorate([
    (0, common_1.Injectable)()
], ResponseInterceptor);
//# sourceMappingURL=response.interceptor.js.map