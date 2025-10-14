# NIRI Backend API Testing Guide

This guide provides detailed information on how to test the NIRI Backend API using the REST Client extension for Visual Studio Code.

## Prerequisites

1. Visual Studio Code installed
2. REST Client extension installed in VS Code
   - Search for "REST Client" in the Extensions marketplace
   - Install the extension by Huachao Mao

## Setting Up

1. Open the `api-tests.http` file in VS Code
2. The REST Client extension will automatically recognize the HTTP request format
3. You should see "Send Request" links above each request

## Understanding the API Tests

The `api-tests.http` file contains the following categories of requests:

### Authentication Endpoints

- **Login**: Get JWT token for authentication
- **Register**: Create a new user
- **Get Profile**: Retrieve current user profile
- **Change Password**: Update user password

### Submission Endpoints

- **Get All Submissions**: List all submissions based on user role
- **Get Submission by ID**: View details of a specific submission
- **Create Submission**: Create a new submission
- **Update Submission**: Modify an existing submission
- **Submit to State**: Submit draft for state approval
- **Submit to MOSPI**: Submit for MOSPI review

### Dashboard Endpoints

- **Get Dashboard Statistics**: Retrieve aggregated dashboard data
- **Get State Summary**: View state-level summary
- **Get Status Distribution**: Get submission status breakdown

## Running Tests

1. Start with the login request to obtain the JWT token
2. The REST Client automatically stores the token in a variable
3. Subsequent requests will use this token for authentication
4. Click on "Send Request" above each request to execute it
5. Results will display in a new panel to the right

## Troubleshooting Common Issues

1. **Connection refused**: Ensure the backend server is running on port 3000
2. **401 Unauthorized**: Check that your JWT token is valid
3. **404 Not Found**: Verify the endpoint URL is correct
4. **500 Server Error**: Check server logs for detailed error information

## Test User Credentials

The system has been set up with the following test user:

- **Email**: admin@niri.gov.in
- **Password**: Admin@123
- **Role**: MOSPI_APPROVER
- **State**: Central

You can use these credentials for testing the API.

## Additional Information

- JWT tokens expire after 24 hours
- File uploads are stored in the `uploads` directory
- Role-based access controls restrict certain endpoints based on user role
