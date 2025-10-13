#!/bin/bash

echo "🚀 Setting up NIRI Backend Database..."

# Create database using createdb command
echo "📦 Creating database 'niri_backend'..."
createdb niri_backend 2>/dev/null || echo "Database might already exist"

# Set environment variables
export DB_HOST=localhost
export DB_PORT=5432
export DB_USERNAME=vishu
export DB_PASSWORD=""
export DB_DATABASE=niri_backend
export NODE_ENV=development

echo "🔧 Building the project..."
npm run build

echo "🔄 Running migrations..."
npm run migration:run

echo "✅ Database setup complete!"
echo ""
echo "📋 Login credentials:"
echo "Email: nodal.officer@example.com | Password: password123"
echo "Email: state.approver@example.com | Password: password123"
echo "Email: mospi.reviewer@example.com | Password: password123"
echo "Email: mospi.approver@example.com | Password: password123"
echo "Email: admin@niri.gov.in | Password: password123"
