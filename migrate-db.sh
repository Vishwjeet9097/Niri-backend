#!/bin/bash

# NIRI Database Migration Script
# यह script database को migrate करने के लिए है

echo "🚀 NIRI Database Migration Script शुरू हो रहा है..."

# Environment variables load करना
if [ -f .env ]; then
    echo "📋 Environment variables load कर रहे हैं..."
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "❌ .env file नहीं मिली! कृपया .env.example को copy करके .env बनाएं"
    exit 1
fi

# Database connection test
echo "🔍 Database connection test कर रहे हैं..."
npm run typeorm -- query "SELECT 1" -d src/database/data-source.ts

if [ $? -eq 0 ]; then
    echo "✅ Database connection successful!"
else
    echo "❌ Database connection failed! कृपया database credentials check करें"
    exit 1
fi

# Migration run करना
echo "🔄 Database migrations run कर रहे हैं..."
npm run migration:run

if [ $? -eq 0 ]; then
    echo "✅ Migrations successfully completed!"
else
    echo "❌ Migration failed! कृपया logs check करें"
    exit 1
fi

echo "🎉 Database migration पूरी हो गई!"
