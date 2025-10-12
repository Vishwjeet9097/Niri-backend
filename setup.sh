#!/bin/bash

# NIRI Backend Setup Script
echo "🚀 Setting up NIRI Backend API..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed. Please install PostgreSQL 13+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"
echo "✅ PostgreSQL $(psql --version) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp env.example .env
    echo "⚠️  Please update .env file with your database credentials"
fi

# Create test environment file if it doesn't exist
if [ ! -f .env.test ]; then
    echo "📝 Creating .env.test file..."
    cp env.test .env.test
fi

# Create database
echo "🗄️  Creating database..."
createdb niri_db 2>/dev/null || echo "Database niri_db already exists or creation failed"

# Create test database
echo "🗄️  Creating test database..."
createdb niri_test_db 2>/dev/null || echo "Test database niri_test_db already exists or creation failed"

# Run migrations
echo "🔄 Running database migrations..."
npm run migration:run

# Run tests
echo "🧪 Running tests..."
npm run test

echo "✅ Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Update .env file with your database credentials"
echo "2. Start the application: npm run start:dev"
echo "3. Import niri_api_collection.json into Postman for testing"
echo "4. Visit http://localhost:3000/health to verify the API is running"
echo ""
echo "🎉 Happy coding!"
