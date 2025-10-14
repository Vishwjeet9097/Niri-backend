import { Injectable } from '@nestjs/common';
import { INDIAN_STATES_AND_UTS, getStatesForDropdown, isValidState, STATES_ONLY, UNION_TERRITORIES } from '../../constants/states';

@Injectable()
export class StateService {
  /**
   * Get all Indian states and union territories
   */
  async getAllStates() {
    return {
      success: true,
      data: {
        states: getStatesForDropdown(),
        total: INDIAN_STATES_AND_UTS.length,
        statesCount: STATES_ONLY.length,
        unionTerritoriesCount: UNION_TERRITORIES.length
      }
    };
  }

  /**
   * Get only states (excluding union territories)
   */
  async getStatesOnly() {
    return {
      success: true,
      data: {
        states: STATES_ONLY.map(state => ({
          value: state,
          label: state
        })),
        total: STATES_ONLY.length
      }
    };
  }

  /**
   * Get only union territories
   */
  async getUnionTerritories() {
    return {
      success: true,
      data: {
        states: UNION_TERRITORIES.map(state => ({
          value: state,
          label: state
        })),
        total: UNION_TERRITORIES.length
      }
    };
  }

  /**
   * Validate if a state is valid
   */
  async validateState(state: string) {
    const isValid = isValidState(state);
    return {
      success: true,
      data: {
        state,
        isValid,
        message: isValid ? 'Valid state' : 'Invalid state'
      }
    };
  }

  /**
   * Get states for specific user role
   * State Approvers can only see their state
   * MoSPI roles can see all states
   */
  async getStatesForUser(userRole: string, userState?: string) {
    // MoSPI roles can see all states
    if (userRole === 'MOSPI_REVIEWER' || userRole === 'MOSPI_APPROVER') {
      return this.getAllStates();
    }

    // State Approvers can only see their state
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

    // Default: return all states
    return this.getAllStates();
  }
}
