export declare class StateService {
    getAllStates(): Promise<{
        success: boolean;
        data: {
            states: {
                value: "Andhra Pradesh" | "Arunachal Pradesh" | "Assam" | "Bihar" | "Chhattisgarh" | "Goa" | "Gujarat" | "Haryana" | "Himachal Pradesh" | "Jharkhand" | "Karnataka" | "Kerala" | "Madhya Pradesh" | "Maharashtra" | "Manipur" | "Meghalaya" | "Mizoram" | "Nagaland" | "Odisha" | "Punjab" | "Rajasthan" | "Sikkim" | "Tamil Nadu" | "Telangana" | "Tripura" | "Uttar Pradesh" | "Uttarakhand" | "West Bengal" | "Andaman and Nicobar Islands" | "Chandigarh" | "Dadra and Nagar Haveli and Daman and Diu" | "Delhi" | "Jammu and Kashmir" | "Ladakh" | "Lakshadweep" | "Puducherry";
                label: "Andhra Pradesh" | "Arunachal Pradesh" | "Assam" | "Bihar" | "Chhattisgarh" | "Goa" | "Gujarat" | "Haryana" | "Himachal Pradesh" | "Jharkhand" | "Karnataka" | "Kerala" | "Madhya Pradesh" | "Maharashtra" | "Manipur" | "Meghalaya" | "Mizoram" | "Nagaland" | "Odisha" | "Punjab" | "Rajasthan" | "Sikkim" | "Tamil Nadu" | "Telangana" | "Tripura" | "Uttar Pradesh" | "Uttarakhand" | "West Bengal" | "Andaman and Nicobar Islands" | "Chandigarh" | "Dadra and Nagar Haveli and Daman and Diu" | "Delhi" | "Jammu and Kashmir" | "Ladakh" | "Lakshadweep" | "Puducherry";
            }[];
            total: 36;
            statesCount: number;
            unionTerritoriesCount: number;
        };
    }>;
    getStatesOnly(): Promise<{
        success: boolean;
        data: {
            states: {
                value: "Andhra Pradesh" | "Arunachal Pradesh" | "Assam" | "Bihar" | "Chhattisgarh" | "Goa" | "Gujarat" | "Haryana" | "Himachal Pradesh" | "Jharkhand" | "Karnataka" | "Kerala" | "Madhya Pradesh" | "Maharashtra" | "Manipur" | "Meghalaya" | "Mizoram" | "Nagaland" | "Odisha" | "Punjab" | "Rajasthan" | "Sikkim" | "Tamil Nadu" | "Telangana" | "Tripura" | "Uttar Pradesh" | "Uttarakhand" | "West Bengal" | "Andaman and Nicobar Islands" | "Chandigarh" | "Dadra and Nagar Haveli and Daman and Diu" | "Delhi" | "Jammu and Kashmir" | "Ladakh" | "Lakshadweep" | "Puducherry";
                label: "Andhra Pradesh" | "Arunachal Pradesh" | "Assam" | "Bihar" | "Chhattisgarh" | "Goa" | "Gujarat" | "Haryana" | "Himachal Pradesh" | "Jharkhand" | "Karnataka" | "Kerala" | "Madhya Pradesh" | "Maharashtra" | "Manipur" | "Meghalaya" | "Mizoram" | "Nagaland" | "Odisha" | "Punjab" | "Rajasthan" | "Sikkim" | "Tamil Nadu" | "Telangana" | "Tripura" | "Uttar Pradesh" | "Uttarakhand" | "West Bengal" | "Andaman and Nicobar Islands" | "Chandigarh" | "Dadra and Nagar Haveli and Daman and Diu" | "Delhi" | "Jammu and Kashmir" | "Ladakh" | "Lakshadweep" | "Puducherry";
            }[];
            total: number;
        };
    }>;
    getUnionTerritories(): Promise<{
        success: boolean;
        data: {
            states: {
                value: "Andhra Pradesh" | "Arunachal Pradesh" | "Assam" | "Bihar" | "Chhattisgarh" | "Goa" | "Gujarat" | "Haryana" | "Himachal Pradesh" | "Jharkhand" | "Karnataka" | "Kerala" | "Madhya Pradesh" | "Maharashtra" | "Manipur" | "Meghalaya" | "Mizoram" | "Nagaland" | "Odisha" | "Punjab" | "Rajasthan" | "Sikkim" | "Tamil Nadu" | "Telangana" | "Tripura" | "Uttar Pradesh" | "Uttarakhand" | "West Bengal" | "Andaman and Nicobar Islands" | "Chandigarh" | "Dadra and Nagar Haveli and Daman and Diu" | "Delhi" | "Jammu and Kashmir" | "Ladakh" | "Lakshadweep" | "Puducherry";
                label: "Andhra Pradesh" | "Arunachal Pradesh" | "Assam" | "Bihar" | "Chhattisgarh" | "Goa" | "Gujarat" | "Haryana" | "Himachal Pradesh" | "Jharkhand" | "Karnataka" | "Kerala" | "Madhya Pradesh" | "Maharashtra" | "Manipur" | "Meghalaya" | "Mizoram" | "Nagaland" | "Odisha" | "Punjab" | "Rajasthan" | "Sikkim" | "Tamil Nadu" | "Telangana" | "Tripura" | "Uttar Pradesh" | "Uttarakhand" | "West Bengal" | "Andaman and Nicobar Islands" | "Chandigarh" | "Dadra and Nagar Haveli and Daman and Diu" | "Delhi" | "Jammu and Kashmir" | "Ladakh" | "Lakshadweep" | "Puducherry";
            }[];
            total: number;
        };
    }>;
    validateState(state: string): Promise<{
        success: boolean;
        data: {
            state: string;
            isValid: boolean;
            message: string;
        };
    }>;
    getStatesForUser(userRole: string, userState?: string): Promise<{
        success: boolean;
        data: {
            states: {
                value: "Andhra Pradesh" | "Arunachal Pradesh" | "Assam" | "Bihar" | "Chhattisgarh" | "Goa" | "Gujarat" | "Haryana" | "Himachal Pradesh" | "Jharkhand" | "Karnataka" | "Kerala" | "Madhya Pradesh" | "Maharashtra" | "Manipur" | "Meghalaya" | "Mizoram" | "Nagaland" | "Odisha" | "Punjab" | "Rajasthan" | "Sikkim" | "Tamil Nadu" | "Telangana" | "Tripura" | "Uttar Pradesh" | "Uttarakhand" | "West Bengal" | "Andaman and Nicobar Islands" | "Chandigarh" | "Dadra and Nagar Haveli and Daman and Diu" | "Delhi" | "Jammu and Kashmir" | "Ladakh" | "Lakshadweep" | "Puducherry";
                label: "Andhra Pradesh" | "Arunachal Pradesh" | "Assam" | "Bihar" | "Chhattisgarh" | "Goa" | "Gujarat" | "Haryana" | "Himachal Pradesh" | "Jharkhand" | "Karnataka" | "Kerala" | "Madhya Pradesh" | "Maharashtra" | "Manipur" | "Meghalaya" | "Mizoram" | "Nagaland" | "Odisha" | "Punjab" | "Rajasthan" | "Sikkim" | "Tamil Nadu" | "Telangana" | "Tripura" | "Uttar Pradesh" | "Uttarakhand" | "West Bengal" | "Andaman and Nicobar Islands" | "Chandigarh" | "Dadra and Nagar Haveli and Daman and Diu" | "Delhi" | "Jammu and Kashmir" | "Ladakh" | "Lakshadweep" | "Puducherry";
            }[];
            total: 36;
            statesCount: number;
            unionTerritoriesCount: number;
        };
    } | {
        success: boolean;
        data: {
            states: {
                value: string;
                label: string;
            }[];
            total: number;
            restricted: boolean;
            message: string;
        };
    }>;
}
