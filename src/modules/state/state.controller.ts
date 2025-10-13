import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { StateService } from './state.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '../../entities/user.entity';

@Controller('states')
export class StateController {
  constructor(private readonly stateService: StateService) {}

  /**
   * Get all states and union territories
   * Public endpoint - no authentication required
   */
  @Get()
  async getAllStates() {
    return this.stateService.getAllStates();
  }

  /**
   * Get only states (excluding union territories)
   */
  @Get('states-only')
  async getStatesOnly() {
    return this.stateService.getStatesOnly();
  }

  /**
   * Get only union territories
   */
  @Get('union-territories')
  async getUnionTerritories() {
    return this.stateService.getUnionTerritories();
  }

  /**
   * Validate a state
   */
  @Get('validate')
  async validateState(@Query('state') state: string) {
    if (!state) {
      return {
        success: false,
        message: 'State parameter is required'
      };
    }
    return this.stateService.validateState(state);
  }

  /**
   * Get states based on user role and state
   * State Approvers can only see their state
   * MoSPI roles can see all states
   */
  @Get('for-user')
  @UseGuards(JwtAuthGuard)
  async getStatesForUser(@Request() req) {
    const { role, stateUt } = req.user;
    return this.stateService.getStatesForUser(role, stateUt);
  }

  /**
   * Get states for user creation
   * This is the main endpoint for frontend dropdown
   */
  @Get('for-creation')
  @UseGuards(JwtAuthGuard)
  async getStatesForCreation(@Request() req) {
    const { role, stateUt } = req.user;
    
    // State Approvers can only create users for their state
    if (role === UserRole.STATE_APPROVER) {
      return {
        success: true,
        data: {
          states: [{
            value: stateUt,
            label: stateUt,
            selected: true // Default selected
          }],
          total: 1,
          restricted: true,
          message: `You can only create users for ${stateUt}`,
          userRole: role,
          userState: stateUt
        }
      };
    }

    // MoSPI roles can create users for any state
    if (role === UserRole.MOSPI_REVIEWER || role === UserRole.MOSPI_APPROVER) {
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

    // Default case
    return this.stateService.getAllStates();
  }
}
