#!/bin/bash

# NIRI Backend - Production Setup Script
echo "🚀 NIRI Backend Production Setup"
echo "================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if required environment variables are set
check_env_vars() {
    print_info "Checking environment variables..."
    
    required_vars=("DB_HOST" "DB_PORT" "DB_USERNAME" "DB_PASSWORD" "DB_DATABASE")
    missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        print_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        echo ""
        print_info "Please set them using:"
        echo "export DB_HOST=your-host"
        echo "export DB_PORT=5432"
        echo "export DB_USERNAME=your-username"
        echo "export DB_PASSWORD=your-password"
        echo "export DB_DATABASE=your-database"
        echo "export DB_SSL=require"
        exit 1
    fi
    
    print_success "All required environment variables are set"
}

# Install dependencies
install_dependencies() {
    print_info "Installing dependencies..."
    if npm install; then
        print_success "Dependencies installed successfully"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
}

# Run database migration
run_migration() {
    print_info "Running database migration..."
    if npm run migration:run; then
        print_success "Database migration completed successfully"
    else
        print_error "Database migration failed"
        print_info "Trying alternative migration method..."
        
        # Try with explicit SSL mode
        if NODE_ENV=production DB_SSL=require npm run migration:run; then
            print_success "Database migration completed with SSL"
        else
            print_error "Migration failed. Please check database connection and credentials"
            exit 1
        fi
    fi
}

# Test database connection
test_connection() {
    print_info "Testing database connection..."
    if curl -s http://localhost:3000/health > /dev/null; then
        print_success "Database connection successful"
    else
        print_warning "Cannot test connection - application not running"
        print_info "Start application with: npm run start:prod"
    fi
}

# Test user login
test_login() {
    print_info "Testing user login..."
    
    # Test Nodal Officer login
    response=$(curl -s -X POST http://localhost:3000/auth/login \
        -H "Content-Type: application/json" \
        -d '{"email":"nodal@niri.gov.in","password":"password123"}')
    
    if echo "$response" | grep -q "Login successful"; then
        print_success "Nodal Officer login successful"
    else
        print_warning "Login test failed - application may not be running"
    fi
}

# Show created users
show_users() {
    print_info "Default users created:"
    echo ""
    echo "📧 Email                           | 🔑 Password    | 👤 Role              | 🏛️  State/UT"
    echo "-----------------------------------|----------------|---------------------|----------------"
    echo "nodal@niri.gov.in                  | password123    | NODAL_OFFICER       | Maharashtra"
    echo "state@niri.gov.in                  | password123    | STATE_APPROVER      | Maharashtra"
    echo "mospi.reviewer@niri.gov.in         | password123    | MOSPI_REVIEWER      | Central"
    echo "mospi.approver@niri.gov.in         | password123    | MOSPI_APPROVER      | Central"
    echo ""
}

# Main execution
main() {
    echo ""
    print_info "Starting production setup..."
    echo ""
    
    # Check environment variables
    check_env_vars
    
    # Install dependencies
    install_dependencies
    
    # Run migration
    run_migration
    
    # Show created users
    show_users
    
    # Test connection (if app is running)
    test_connection
    
    # Test login (if app is running)
    test_login
    
    echo ""
    print_success "Production setup completed!"
    echo ""
    print_info "Next steps:"
    echo "1. Start application: npm run start:prod"
    echo "2. Test API: curl http://localhost:3000/health"
    echo "3. Login with any of the created users"
    echo ""
    print_info "For detailed documentation, see MIGRATION_GUIDE.md"
}

# Run main function
main
