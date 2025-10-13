"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateService = void 0;
const common_1 = require("@nestjs/common");
const states_1 = require("../../constants/states");
let StateService = class StateService {
    async getAllStates() {
        return {
            success: true,
            data: {
                states: (0, states_1.getStatesForDropdown)(),
                total: states_1.INDIAN_STATES_AND_UTS.length,
                statesCount: states_1.STATES_ONLY.length,
                unionTerritoriesCount: states_1.UNION_TERRITORIES.length
            }
        };
    }
    async getStatesOnly() {
        return {
            success: true,
            data: {
                states: states_1.STATES_ONLY.map(state => ({
                    value: state,
                    label: state
                })),
                total: states_1.STATES_ONLY.length
            }
        };
    }
    async getUnionTerritories() {
        return {
            success: true,
            data: {
                states: states_1.UNION_TERRITORIES.map(state => ({
                    value: state,
                    label: state
                })),
                total: states_1.UNION_TERRITORIES.length
            }
        };
    }
    async validateState(state) {
        const isValid = (0, states_1.isValidState)(state);
        return {
            success: true,
            data: {
                state,
                isValid,
                message: isValid ? 'Valid state' : 'Invalid state'
            }
        };
    }
    async getStatesForUser(userRole, userState) {
        if (userRole === 'MOSPI_REVIEWER' || userRole === 'MOSPI_APPROVER') {
            return this.getAllStates();
        }
        if (userRole === 'STATE_APPROVER' && userState) {
            return {
                success: true,
                data: {
                    states: [{
                            value: userState,
                            label: userState
                        }],
                    total: 1,
                    restricted: true,
                    message: `You can only create users for ${userState}`
                }
            };
        }
        return this.getAllStates();
    }
};
exports.StateService = StateService;
exports.StateService = StateService = __decorate([
    (0, common_1.Injectable)()
], StateService);
//# sourceMappingURL=state.service.js.map