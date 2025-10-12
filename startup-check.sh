#!/bin/bash

# NIRI Backend Startup Check Script
# This script checks if the NIRI Backend API is ready

URL="http://localhost:3000/health"
DELAY_SECONDS=3
MAX_ATTEMPTS=20

echo "🔄 NIRI बैकएंड तैयार होने की प्रतीक्षा कर रहा है..."
echo "📍 Checking: $URL"
echo "⏱️  Max attempts: $MAX_ATTEMPTS (Total wait time: $((MAX_ATTEMPTS * DELAY_SECONDS)) seconds)"
echo ""

for i in $(seq 1 $MAX_ATTEMPTS); do
    # Check if application is responding
    curl -sf "$URL" -o /dev/null
    
    if [ $? -eq 0 ]; then
        echo "✅ NIRI बैकएंड तैयार है!"
        echo ""
        echo "📊 Application Status:"
        curl -s "$URL" | jq . 2>/dev/null || curl -s "$URL"
        echo ""
        echo "🎉 आपका NIRI Backend API सफलतापूर्वक चल रहा है!"
        exit 0
    fi
    
    echo "⏳ प्रयास $i/$MAX_ATTEMPTS विफल रहा। $DELAY_SECONDS सेकंड का इंतज़ार..."
    sleep $DELAY_SECONDS
done

echo ""
echo "❌ NIRI बैकएंड तय समय में शुरू नहीं हो पाया।"
echo ""
echo "🔍 Possible Issues:"
echo "   - Database connection failed"
echo "   - Port 3000 is already in use"
echo "   - Application compilation errors"
echo "   - Missing environment variables"
echo ""
echo "🛠️  Troubleshooting Steps:"
echo "   1. Check terminal logs for errors"
echo "   2. Verify database is running: brew services list | grep postgresql"
echo "   3. Check port usage: lsof -ti:3000"
echo "   4. Verify .env file exists and is configured correctly"
echo ""
exit 1
