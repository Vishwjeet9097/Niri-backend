const { Client } = require("pg");
const bcrypt = require("bcryptjs");

const client = new Client({
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "postgres123",
  database: "niri_backend", // Connect to default postgres database first
});

async function seedUsers() {
  try {
    await client.connect();
    console.log("Connected to database");

    // Create database if it doesn't exist
    await client.query("CREATE DATABASE niri_backend;").catch(() => {
      console.log("Database already exists or creation failed");
    });

    // Connect to the specific database
    await client.end();
    const dbClient = new Client({
      host: "localhost",
      port: 5432,
      user: "postgres",
      password: "postgres123",
      database: "niri_backend",
    });
    await dbClient.connect();

    // Hash password
    const hashedPassword = await bcrypt.hash("password123", 10);

    // Create users table if it doesn't exist
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR UNIQUE NOT NULL,
        password VARCHAR NOT NULL,
        "firstName" VARCHAR NOT NULL,
        "lastName" VARCHAR NOT NULL,
        role VARCHAR NOT NULL CHECK (role IN ('NODAL_OFFICER', 'STATE_APPROVER', 'MOSPI_REVIEWER', 'MOSPI_APPROVER')),
        "stateUt" VARCHAR,
        "isActive" BOOLEAN DEFAULT true,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Enable UUID extension
    await dbClient.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    // Insert seed users
    const users = [
      {
        email: "nodal.officer@example.com",
        firstName: "Rajesh",
        lastName: "Kumar",
        role: "NODAL_OFFICER",
        stateUt: "Delhi",
      },
      {
        email: "state.approver@example.com",
        firstName: "Priya",
        lastName: "Sharma",
        role: "STATE_APPROVER",
        stateUt: "Delhi",
      },
      {
        email: "mospi.reviewer@example.com",
        firstName: "Amit",
        lastName: "Singh",
        role: "MOSPI_REVIEWER",
        stateUt: null,
      },
      {
        email: "mospi.approver@example.com",
        firstName: "Sneha",
        lastName: "Patel",
        role: "MOSPI_APPROVER",
        stateUt: null,
      },
      {
        email: "admin@niri.gov.in",
        firstName: "Admin",
        lastName: "User",
        role: "MOSPI_APPROVER",
        stateUt: null,
      },
    ];

    for (const user of users) {
      await dbClient.query(
        `
        INSERT INTO users (email, password, "firstName", "lastName", role, "stateUt")
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (email) DO UPDATE SET
          password = EXCLUDED.password,
          "firstName" = EXCLUDED."firstName",
          "lastName" = EXCLUDED."lastName",
          role = EXCLUDED.role,
          "stateUt" = EXCLUDED."stateUt",
          "updatedAt" = CURRENT_TIMESTAMP
      `,
        [
          user.email,
          hashedPassword,
          user.firstName,
          user.lastName,
          user.role,
          user.stateUt,
        ]
      );

      console.log(`✅ User created/updated: ${user.email} (${user.role})`);
    }

    console.log("\n🎉 All users seeded successfully!");
    console.log("\nLogin credentials:");
    console.log("Email: nodal.officer@example.com | Password: password123");
    console.log("Email: state.approver@example.com | Password: password123");
    console.log("Email: mospi.reviewer@example.com | Password: password123");
    console.log("Email: mospi.approver@example.com | Password: password123");
    console.log("Email: admin@niri.gov.in | Password: password123");
  } catch (error) {
    console.error("Error seeding users:", error);
  } finally {
    await client.end();
  }
}

seedUsers();
