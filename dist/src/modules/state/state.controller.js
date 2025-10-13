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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateController = void 0;
const common_1 = require("@nestjs/common");
const state_service_1 = require("./state.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const user_entity_1 = require("../../entities/user.entity");
let StateController = class StateController {
    constructor(stateService) {
        this.stateService = stateService;
    }
    async getAllStates() {
        return this.stateService.getAllStates();
    }
    async getStatesOnly() {
        return this.stateService.getStatesOnly();
    }
    async getUnionTerritories() {
        return this.stateService.getUnionTerritories();
    }
    async validateState(state) {
        if (!state) {
            return {
                success: false,
                message: 'State parameter is required'
            };
        }
        return this.stateService.validateState(state);
    }
    async getStatesForUser(req) {
        const { role, stateUt } = req.user;
        return this.stateService.getStatesForUser(role, stateUt);
    }
    async getStatesForCreation(req) {
        const { role, stateUt } = req.user;
        if (role === user_entity_1.UserRole.STATE_APPROVER) {
            return {
                success: true,
                data: {
                    states: [{
                            value: stateUt,
                            label: stateUt,
                            selected: true
                        }],
                    total: 1,
                    restricted: true,
                    message: `You can only create users for ${stateUt}`,
                    userRole: role,
                    userState: stateUt
                }
            };
        }
        if (role === user_entity_1.UserRole.MOSPI_REVIEWER || role === user_entity_1.UserRole.MOSPI_APPROVER) {
            const allStates = await this.stateService.getAllStates();
            return {
                ...allStates,
                data: {
                    ...allStates.data,
                    restricted: false,
                    message: 'You can create users for any state',
                    userRole: role
                }
            };
        }
        return this.stateService.getAllStates();
    }
};
exports.StateController = StateController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StateController.prototype, "getAllStates", null);
__decorate([
    (0, common_1.Get)('states-only'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StateController.prototype, "getStatesOnly", null);
__decorate([
    (0, common_1.Get)('union-territories'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StateController.prototype, "getUnionTerritories", null);
__decorate([
    (0, common_1.Get)('validate'),
    __param(0, (0, common_1.Query)('state')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StateController.prototype, "validateState", null);
__decorate([
    (0, common_1.Get)('for-user'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StateController.prototype, "getStatesForUser", null);
__decorate([
    (0, common_1.Get)('for-creation'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StateController.prototype, "getStatesForCreation", null);
exports.StateController = StateController = __decorate([
    (0, common_1.Controller)('states'),
    __metadata("design:paramtypes", [state_service_1.StateService])
], StateController);
//# sourceMappingURL=state.controller.js.map