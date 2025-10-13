# Postman Collection for NIRI Backend API

I've created two files for you to import into Postman:

1. `NIRI_Backend_API_Collection.postman_collection.json` - The complete collection of API endpoints
2. `NIRI_Environment.postman_environment.json` - Environment variables for the collection

## How to Import into Postman

### Method 1: Using Postman Desktop App

1. Open Postman
2. Click on "Import" in the top left corner
3. Select "Files" and navigate to both JSON files
4. Click "Import"

### Method 2: Using Postman Web

1. Go to [Postman Web](https://go.postman.co/home)
2. Click on "Import" in the top left corner
3. Upload both JSON files
4. Click "Import"

## Collection Features

The NIRI Backend API collection includes:

- **Environment Variables**: Automatically stores authentication token and submission ID
- **Pre-request Scripts**: Sets up necessary variables for requests
- **Test Scripts**: Extracts and stores tokens from responses
- **Organized Structure**: Endpoints are grouped by functionality

## Available API Groups

1. **Connectivity Tests**: Basic health checks
2. **Authentication**: Login, register, profile, password management
3. **Submissions**: Create, update, submit, and manage submissions
4. **Dashboard**: Statistical data and reporting
5. **Audit Logs**: Track system activities
6. **User Management**: Manage user accounts

## Using the Collection

1. First select the "NIRI Environment" from the environment dropdown in the top right
2. Run the "Login" request to authenticate and store the token
3. The token is automatically used for all subsequent requests
4. Create a submission to automatically store the submission ID
5. Use that ID for all submission-related requests

## Testing Different Roles

To test different user roles, use these credentials:

- **MOSPI_APPROVER**: admin@niri.gov.in / Admin@123
- **NODAL_OFFICER**: maharashtra.nodal@maharashtra.gov.in / password123
- **STATE_APPROVER**: maharashtra.state@maharashtra.gov.in / password123

## Customizing Requests

Feel free to modify the request bodies and parameters as needed for your testing scenarios. The collection provides a starting point that covers all the endpoints in the NIRI Backend API.