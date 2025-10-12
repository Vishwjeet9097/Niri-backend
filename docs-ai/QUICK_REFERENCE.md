# 🚀 NIRI Backend - Quick Reference Card

## ⚡ Daily Startup Commands

```bash
# 1. Navigate to project
cd /Users/vishu/Public/Git\ Workspace\ Projects/Niri-Dev/niri-backend

# 2. Start application
npm run start:dev

# 3. Check if ready (in new terminal)
./startup-check.sh
```

## 🔧 Essential Commands

| Command                  | Purpose                  |
| ------------------------ | ------------------------ |
| `npm run start:dev`      | Start development server |
| `npm run start:prod`     | Start production server  |
| `npm run migration:run`  | Run database migrations  |
| `npm run migration:show` | Show migration status    |
| `npm run test`           | Run unit tests           |
| `npm run test:e2e`       | Run end-to-end tests     |

## 🌐 API Endpoints

| Method | Endpoint           | Purpose                  |
| ------ | ------------------ | ------------------------ |
| `GET`  | `/health`          | Check application status |
| `GET`  | `/`                | Welcome message          |
| `POST` | `/auth/register`   | User registration        |
| `POST` | `/auth/login`      | User login               |
| `GET`  | `/users`           | List users (protected)   |
| `POST` | `/submission`      | Create submission        |
| `POST` | `/file/upload/:id` | Upload file              |

## 🔐 User Roles

- `NODAL_OFFICER` - Can create submissions
- `STATE_APPROVER` - Can approve/reject at state level
- `MOSPI_REVIEWER` - Can review submissions
- `MOSPI_APPROVER` - Can give final approval

## 📊 Database Tables

- `users` - User management
- `submissions` - Submission workflow
- `audit_logs` - Activity tracking
- `final_scores` - Scoring system

## 🚨 Quick Fixes

### Database Connection Failed

```bash
brew services start postgresql
psql -U postgres -d niri_db
```

### Port Already in Use

```bash
kill -9 $(lsof -ti:3000)
```

### Application Not Starting

```bash
npm install
npm run migration:run
npm run start:dev
```

## 📱 Health Check Response

```json
{
  "status": "OK",
  "database": {
    "connected": true,
    "tables": 4
  },
  "uptime": 73.09
}
```

## 🔑 Environment Variables

```bash
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres123
DB_NAME=niri_db
JWT_SECRET=your-secret-key
PORT=3000
```

## 📞 Support

- Check terminal logs for errors
- Verify database connection
- Review `PROJECT_STARTUP_GUIDE.md`
- Use `./startup-check.sh` for status

---

**🎯 Success = Green health check + All 4 tables found + JWT token generation**
