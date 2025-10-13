#!/bin/bash

# NIRI Dummy Data Seeding Script
# यह script database में dummy data भरने के लिए है

echo "🌱 NIRI Dummy Data Seeding Script शुरू हो रहा है..."

# Environment variables load करना
if [ -f .env ]; then
    echo "📋 Environment variables load कर रहे हैं..."
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "❌ .env file नहीं मिली!"
    exit 1
fi

# Database connection test
echo "🔍 Database connection test कर रहे हैं..."
npm run typeorm -- query "SELECT 1" -d src/database/data-source.ts

if [ $? -eq 0 ]; then
    echo "✅ Database connection successful!"
else
    echo "❌ Database connection failed!"
    exit 1
fi

# Dummy data SQL queries
echo "📊 Dummy data insert कर रहे हैं..."

# Users table में dummy data
echo "👥 Users table में data insert कर रहे हैं..."
npm run typeorm -- query "
INSERT INTO users (id, username, email, password, role, full_name, organization, designation, phone, is_active, created_at, updated_at) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'admin', 'admin@niri.gov.in', '\$2b\$10\$rQZ8K9vL8xN5mP2qR1sT3uV4wX7yZ9aB2cD5eF8gH1jK4mN7pQ0sT3uV6wX9zA', 'admin', 'System Administrator', 'NIRI', 'Admin', '+91-9876543210', true, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440002', 'evaluator1', 'evaluator1@niri.gov.in', '\$2b\$10\$rQZ8K9vL8xN5mP2qR1sT3uV4wX7yZ9aB2cD5eF8gH1jK4mN7pQ0sT3uV6wX9zA', 'evaluator', 'Dr. Rajesh Kumar', 'Ministry of Urban Development', 'Senior Evaluator', '+91-9876543211', true, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440003', 'evaluator2', 'evaluator2@niri.gov.in', '\$2b\$10\$rQZ8K9vL8xN5mP2qR1sT3uV4wX7yZ9aB2cD5eF8gH1jK4mN7pQ0sT3uV6wX9zA', 'evaluator', 'Dr. Priya Sharma', 'Ministry of Housing', 'Principal Evaluator', '+91-9876543212', true, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440004', 'viewer1', 'viewer1@niri.gov.in', '\$2b\$10\$rQZ8K9vL8xN5mP2qR1sT3uV4wX7yZ9aB2cD5eF8gH1jK4mN7pQ0sT3uV6wX9zA', 'viewer', 'Amit Singh', 'Planning Commission', 'Research Analyst', '+91-9876543213', true, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440005', 'viewer2', 'viewer2@niri.gov.in', '\$2b\$10\$rQZ8K9vL8xN5mP2qR1sT3uV4wX7yZ9aB2cD5eF8gH1jK4mN7pQ0sT3uV6wX9zA', 'viewer', 'Sneha Patel', 'NITI Aayog', 'Policy Analyst', '+91-9876543214', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
" -d src/database/data-source.ts

# Submissions table में dummy data
echo "📝 Submissions table में data insert कर रहे हैं..."
npm run typeorm -- query "
INSERT INTO submissions (id, state_name, district_name, city_name, submission_type, status, submitted_by, evaluation_data, file_paths, created_at, updated_at) VALUES
('sub-001', 'Maharashtra', 'Mumbai', 'Mumbai', 'infrastructure', 'submitted', '550e8400-e29b-41d4-a716-446655440002', '{\"transport\": 85, \"water\": 78, \"energy\": 92, \"telecom\": 88, \"healthcare\": 76, \"education\": 82}', '[\"uploads/mumbai-infrastructure-report.pdf\"]', NOW(), NOW()),
('sub-002', 'Karnataka', 'Bangalore Urban', 'Bangalore', 'infrastructure', 'evaluated', '550e8400-e29b-41d4-a716-446655440002', '{\"transport\": 88, \"water\": 82, \"energy\": 95, \"telecom\": 91, \"healthcare\": 84, \"education\": 89}', '[\"uploads/bangalore-infrastructure-report.pdf\"]', NOW(), NOW()),
('sub-003', 'Tamil Nadu', 'Chennai', 'Chennai', 'infrastructure', 'submitted', '550e8400-e29b-41d4-a716-446655440003', '{\"transport\": 79, \"water\": 85, \"energy\": 87, \"telecom\": 83, \"healthcare\": 88, \"education\": 85}', '[\"uploads/chennai-infrastructure-report.pdf\"]', NOW(), NOW()),
('sub-004', 'Gujarat', 'Ahmedabad', 'Ahmedabad', 'infrastructure', 'evaluated', '550e8400-e29b-41d4-a716-446655440003', '{\"transport\": 82, \"water\": 79, \"energy\": 89, \"telecom\": 86, \"healthcare\": 81, \"education\": 87}', '[\"uploads/ahmedabad-infrastructure-report.pdf\"]', NOW(), NOW()),
('sub-005', 'Delhi', 'New Delhi', 'New Delhi', 'infrastructure', 'submitted', '550e8400-e29b-41d4-a716-446655440002', '{\"transport\": 91, \"water\": 74, \"energy\": 93, \"telecom\": 94, \"healthcare\": 89, \"education\": 91}', '[\"uploads/delhi-infrastructure-report.pdf\"]', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
" -d src/database/data-source.ts

# Final scores table में dummy data
echo "🏆 Final scores table में data insert कर रहे हैं..."
npm run typeorm -- query "
INSERT INTO final_scores (id, submission_id, overall_score, category_scores, evaluated_by, evaluation_notes, created_at, updated_at) VALUES
('score-001', 'sub-002', 87.5, '{\"transport\": 88, \"water\": 82, \"energy\": 95, \"telecom\": 91, \"healthcare\": 84, \"education\": 89}', '550e8400-e29b-41d4-a716-446655440002', 'Excellent infrastructure development with strong energy and telecom sectors', NOW(), NOW()),
('score-002', 'sub-004', 84.0, '{\"transport\": 82, \"water\": 79, \"energy\": 89, \"telecom\": 86, \"healthcare\": 81, \"education\": 87}', '550e8400-e29b-41d4-a716-446655440003', 'Good overall performance with room for improvement in water infrastructure', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
" -d src/database/data-source.ts

echo "✅ Dummy data successfully inserted!"
echo "📊 Data summary:"
echo "   - 5 Users (1 admin, 2 evaluators, 2 viewers)"
echo "   - 5 Submissions (different states)"
echo "   - 2 Final scores"
echo "🎉 Dummy data seeding completed!"
