"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UNION_TERRITORIES = exports.STATES_ONLY = exports.INDIAN_STATES_AND_UTS = void 0;
exports.getStatesForDropdown = getStatesForDropdown;
exports.isValidState = isValidState;
exports.INDIAN_STATES_AND_UTS = [
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
    'Andaman and Nicobar Islands',
    'Chandigarh',
    'Dadra and Nagar Haveli and Daman and Diu',
    'Delhi',
    'Jammu and Kashmir',
    'Ladakh',
    'Lakshadweep',
    'Puducherry'
];
function getStatesForDropdown() {
    return exports.INDIAN_STATES_AND_UTS.map(state => ({
        value: state,
        label: state
    }));
}
function isValidState(state) {
    return exports.INDIAN_STATES_AND_UTS.includes(state);
}
exports.STATES_ONLY = exports.INDIAN_STATES_AND_UTS.slice(0, 28);
exports.UNION_TERRITORIES = exports.INDIAN_STATES_AND_UTS.slice(28);
//# sourceMappingURL=states.js.map