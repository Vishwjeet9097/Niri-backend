/**
 * Indian States and Union Territories Constants
 * Complete list of all 28 states and 8 union territories
 */

export const INDIAN_STATES_AND_UTS = [
  // States
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  
  // Union Territories
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry'
] as const;

export type StateUt = typeof INDIAN_STATES_AND_UTS[number];

/**
 * Get all states for dropdown/selection
 */
export function getStatesForDropdown() {
  return INDIAN_STATES_AND_UTS.map(state => ({
    value: state,
    label: state
  }));
}

/**
 * Validate if state is valid
 */
export function isValidState(state: string): boolean {
  return INDIAN_STATES_AND_UTS.includes(state as StateUt);
}

/**
 * Get states by category
 */
export const STATES_ONLY = INDIAN_STATES_AND_UTS.slice(0, 28); // First 28 are states
export const UNION_TERRITORIES = INDIAN_STATES_AND_UTS.slice(28); // Last 8 are UTs
