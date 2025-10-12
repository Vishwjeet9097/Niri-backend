# 🚀 NIRI Backend API - Project Startup Guide

## 📋 Prerequisites

### Required Software:

- **Node.js** (v18+ recommended)
- **PostgreSQL** (v12+ recommended)
- **pgAdmin 4** (for database management)
- **Git** (for version control)

### Required Accounts:

- **AWS Account** (for S3 storage - optional)
- **PostgreSQL Database** (local or cloud)

---

## 🛠️ Step-by-Step Setup

### Step 1: Clone and Install Dependencies

```bash
# Navigate to your project directory
cd /Users/vishu/Public/Git\ Workspace\ Projects/Niri-Dev/niri-backend

# Install dependencies
npm install
```

### Step 2: Database Setup

#### Option A: Using pgAdmin 4 (Recommended)

1. **Open pgAdmin 4**
2. **Connect to PostgreSQL server**
3. **Create new database:**
   - Right-click on "Databases" → "Create" → "Database"
   - Name: `niri_db`
   - Owner: `postgres`
4. **Set postgres user password:**
   - Right-click on "postgres" user → "Properties"
   - Go to "Definition" tab
   - Set password to: `postgres123`

#### Option B: Using Command Line

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE niri_db;

# Set password for postgres user
ALTER USER postgres PASSWORD 'postgres123';

# Exit psql
\q
```

### Step 3: Environment Configuration

Create `.env` file in project root:

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres123
DB_NAME=niri_db

# Application Configuration
PORT=3000
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# File Storage Configuration
STORAGE_TYPE=local
STORAGE_PATH_LOCAL=./uploads

# AWS S3 Configuration (Optional)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-s3-bucket-name
```

### Step 4: Database Migration

```bash
# Run database migrations
npm run migration:run

# Verify tables created
npm run migration:show
```

### Step 5: Start Application

```bash
# Start in development mode
npm run start:dev

# Or start in production mode
npm run start:prod
```

### Step 6: Verify Application

```bash
# Check health status
curl http://localhost:3000/health

# Test welcome message
curl http://localhost:3000/
```

---

## 🔧 Quick Start Commands

### Daily Startup Sequence:

```bash
# 1. Navigate to project
cd /Users/vishu/Public/Git\ Workspace\ Projects/Niri-Dev/niri-backend

# 2. Start application
npm run start:dev

# 3. Wait for startup (use the script below)
bash startup-check.sh
```

### Create Startup Check Script:

Create `startup-check.sh`:

```bash
#!/bin/bash
URL="http://localhost:3000/health"
DELAY_SECONDS=3
MAX_ATTEMPTS=20

echo "NIRI बैकएंड तैयार होने की प्रतीक्षा कर रहा है..."

for i in $(seq 1 $MAX_ATTEMPTS); do
    curl -sf "$URL" -o /dev/null

    if [ $? -eq 0 ]; then
        echo "✅ NIRI बैकएंड तैयार है!"
        curl -s "$URL" | jq .
        exit 0
    fi

    echo "प्रयास $i/$MAX_ATTEMPTS विफल रहा। $DELAY_SECONDS सेकंड का इंतज़ार..."
    sleep $DELAY_SECONDS
done

echo "❌ NIRI बैकएंड तय समय में शुरू नहीं हो पाया।"
exit 1
```

Make it executable:

```bash
chmod +x startup-check.sh
```

---

## 🧪 Testing the API

### 1. Register a User

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User",
    "role": "NODAL_OFFICER",
    "stateUt": "Maharashtra"
  }'
```

### 2. Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 3. Test Protected Endpoint

```bash
# Use the token from login response
curl -X GET http://localhost:3000/users \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 📊 Application Status Check

### Health Check Response:

```json
{
  "status": "OK",
  "timestamp": "2025-10-10T18:23:26.449Z",
  "service": "NIRI Backend API",
  "database": {
    "connected": true,
    "tables": 4,
    "requiredTables": ["users", "submissions", "audit_logs", "final_scores"],
    "foundTables": ["audit_logs", "final_scores", "submissions", "users"]
  },
  "uptime": 73.090617834,
  "memory": {
    "rss": 31604736,
    "heapTotal": 51396608,
    "heapUsed": 45667632
  }
}
```

---

## 🚨 Troubleshooting

### Common Issues:

#### 1. Database Connection Failed

```bash
# Check PostgreSQL status
brew services list | grep postgresql

# Start PostgreSQL
brew services start postgresql

# Check connection
psql -U postgres -d niri_db
```

#### 2. Port Already in Use

```bash
# Find process using port 3000
lsof -ti:3000

# Kill the process
kill -9 $(lsof -ti:3000)
```

#### 3. Migration Issues

```bash
# Reset database
npm run migration:revert

# Run migrations again
npm run migration:run
```

#### 4. Permission Issues

```bash
# Fix file permissions
chmod +x startup-check.sh
chmod 755 ./uploads
```

---

## 📁 Project Structure

```
niri-backend/
├── src/
│   ├── entities/          # Database entities
│   ├── modules/           # Feature modules
│   │   ├── auth/          # Authentication
│   │   ├── submission/    # Submission workflow
│   │   ├── storage/       # File storage
│   │   ├── audit/         # Audit logging
│   │   ├── dashboard/     # Dashboard APIs
│   │   └── report/        # Reporting
│   ├── config/            # Configuration
│   ├── migrations/        # Database migrations
│   └── main.ts           # Application entry point
├── test/                 # Test files
├── uploads/              # Local file storage
├── .env                  # Environment variables
├── package.json          # Dependencies
└── README.md            # Project documentation
```

---

## 🔐 Security Notes

1. **Change JWT Secret**: Update `JWT_SECRET` in `.env`
2. **Database Password**: Use strong password for production
3. **AWS Credentials**: Never commit AWS keys to version control
4. **Environment Variables**: Keep `.env` file secure

---

## 📞 Support

If you encounter issues:

1. Check the logs in terminal
2. Verify database connection
3. Check environment variables
4. Review this guide step-by-step

---

## 🎯 Success Indicators

✅ **Application Started Successfully When:**

- Terminal shows: `🚀 NIRI Backend API is running on port 3000`
- Health check returns: `"status": "OK"`
- Database shows: `"connected": true`
- All 4 tables are found: `["audit_logs", "final_scores", "submissions", "users"]`

---

**Happy Coding! 🚀**
