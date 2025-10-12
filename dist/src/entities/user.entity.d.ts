export declare enum UserRole {
    NODAL_OFFICER = "NODAL_OFFICER",
    STATE_APPROVER = "STATE_APPROVER",
    MOSPI_REVIEWER = "MOSPI_REVIEWER",
    MOSPI_APPROVER = "MOSPI_APPROVER"
}
export declare class User {
    id: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    contactNumber: string;
    role: UserRole;
    stateUt: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
