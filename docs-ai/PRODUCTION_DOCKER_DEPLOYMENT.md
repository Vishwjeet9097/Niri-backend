# Production Docker Deployment Guide (Backend Only)

This guide explains how to build and deploy your Niri backend Docker image for production, when your database is managed separately (e.g., AWS RDS).

---

## 1. Prerequisites

- AWS RDS (or other managed DB) is set up and accessible.
- You have DB connection details: host, port, username, password, database name.
- Docker is installed on your deployment server (EC2, ECS, etc.).

## 2. Prepare Environment Variables

Create a `.env.production` file (or set these as secrets in your deployment platform):

```
DB_HOST=<your-rds-endpoint>
DB_PORT=5432
DB_USERNAME=<your-db-username>
DB_PASSWORD=<your-db-password>
DB_DATABASE=<your-db-name>
JWT_SECRET=<your-jwt-secret>
JWT_EXPIRES_IN=24h
NODE_ENV=production
PORT=3000
```

## 3. Build Docker Image

From the project root:

```sh
docker build -t niri-backend:prod .
```

## 4. Run Docker Container

```sh
docker run -d \
  --env-file .env.production \
  -p 3000:3000 \
  --name niri-backend \
  niri-backend:prod
```

- The backend will connect to your managed DB using the provided env variables.

## 5. Run Migrations (if needed)

If you need to run migrations in production:

```sh
docker exec -it niri-backend npm run migration:run
```

## 6. Logs & Management

- View logs:
  ```sh
  docker logs -f niri-backend
  ```
- Stop/remove container:
  ```sh
  docker stop niri-backend && docker rm niri-backend
  ```

---

## Notes

- Do NOT use docker-compose in production if DB is managed separately.
- Always keep your secrets safe (do not commit `.env.production` to git).
- For cloud platforms (ECS, EKS, Azure, etc.), use their environment variable/secrets management.

---

**This guide is for backend-only Docker deployment with an external/managed database.**
