"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const app_service_1 = require("./app.service");
let AppController = class AppController {
    constructor(appService, dataSource) {
        this.appService = appService;
        this.dataSource = dataSource;
    }
    getHello() {
        return this.appService.getHello();
    }
    async getHealth() {
        try {
            await this.dataSource.query('SELECT 1 as test');
            const tables = await this.dataSource.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('users', 'submissions', 'audit_logs', 'final_scores')
      `);
            return {
                status: true,
                data: {
                    service: 'NIRI Backend API',
                    timestamp: new Date().toISOString(),
                    database: {
                        connected: true,
                        tables: tables.length,
                        requiredTables: ['users', 'submissions', 'audit_logs', 'final_scores'],
                        foundTables: tables.map((t) => t.table_name),
                    },
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                },
                message: 'Health check successful',
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            return {
                status: false,
                data: {
                    service: 'NIRI Backend API',
                    timestamp: new Date().toISOString(),
                    database: {
                        connected: false,
                        error: error.message,
                    },
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                },
                message: 'Health check failed',
                timestamp: new Date().toISOString(),
            };
        }
    }
};
exports.AppController = AppController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", String)
], AppController.prototype, "getHello", null);
__decorate([
    (0, common_1.Get)('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AppController.prototype, "getHealth", null);
exports.AppController = AppController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [app_service_1.AppService,
        typeorm_1.DataSource])
], AppController);
//# sourceMappingURL=app.controller.js.map