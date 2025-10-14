#!/bin/bash

# NIRI Database Access Script
# यह script database access और queries के लिए है

echo "🔍 NIRI Database Access Script"

# Environment variables load करना
if [ -f .env ]; then
    echo "📋 Environment variables load कर रहे हैं..."
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "❌ .env file नहीं मिली!"
    exit 1
fi

# Function to show menu
show_menu() {
    echo ""
    echo "📋 Database Access Menu:"
    echo "1. Database connection test करें"
    echo "2. सभी tables list करें"
    echo "3. Users table data देखें"
    echo "4. Submissions table data देखें"
    echo "5. Final scores table data देखें"
    echo "6. Custom SQL query run करें"
    echo "7. Database statistics देखें"
    echo "8. Exit"
    echo ""
}

# Function to run custom query
run_custom_query() {
    echo "💬 Custom SQL query enter करें (exit करने के लिए 'quit' टाइप करें):"
    read -p "SQL> " query
    
    if [ "$query" = "quit" ]; then
        return
    fi
    
    echo "🔄 Query executing: $query"
    npm run typeorm -- query "$query" -d src/database/data-source.ts
}

# Function to show database stats
show_db_stats() {
    echo "📊 Database Statistics:"
    echo ""
    
    echo "👥 Users count:"
    npm run typeorm -- query "SELECT COUNT(*) as user_count FROM users;" -d src/database/data-source.ts
    
    echo ""
    echo "📝 Submissions count:"
    npm run typeorm -- query "SELECT COUNT(*) as submission_count FROM submissions;" -d src/database/data-source.ts
    
    echo ""
    echo "🏆 Final scores count:"
    npm run typeorm -- query "SELECT COUNT(*) as score_count FROM final_scores;" -d src/database/data-source.ts
    
    echo ""
    echo "📋 Audit logs count:"
    npm run typeorm -- query "SELECT COUNT(*) as audit_count FROM audit_logs;" -d src/database/data-source.ts
}

# Main menu loop
while true; do
    show_menu
    read -p "अपना choice enter करें (1-8): " choice
    
    case $choice in
        1)
            echo "🔍 Database connection test कर रहे हैं..."
            npm run typeorm -- query "SELECT 1 as connection_test;" -d src/database/data-source.ts
            ;;
        2)
            echo "📋 सभी tables list कर रहे हैं..."
            npm run typeorm -- query "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';" -d src/database/data-source.ts
            ;;
        3)
            echo "👥 Users table data:"
            npm run typeorm -- query "SELECT id, username, email, role, full_name, organization, is_active, created_at FROM users ORDER BY created_at DESC;" -d src/database/data-source.ts
            ;;
        4)
            echo "📝 Submissions table data:"
            npm run typeorm -- query "SELECT id, state_name, district_name, city_name, submission_type, status, submitted_by, created_at FROM submissions ORDER BY created_at DESC;" -d src/database/data-source.ts
            ;;
        5)
            echo "🏆 Final scores table data:"
            npm run typeorm -- query "SELECT id, submission_id, overall_score, evaluated_by, evaluation_notes, created_at FROM final_scores ORDER BY created_at DESC;" -d src/database/data-source.ts
            ;;
        6)
            run_custom_query
            ;;
        7)
            show_db_stats
            ;;
        8)
            echo "👋 Goodbye!"
            exit 0
            ;;
        *)
            echo "❌ Invalid choice! कृपया 1-8 के बीच में select करें"
            ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
done
