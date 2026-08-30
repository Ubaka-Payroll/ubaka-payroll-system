#!/bin/bash

# Ubaka Attendance Tracking - Database Setup Script

echo "Ubaka Database Setup"
echo "======================="
echo ""

# Database configuration
DB_NAME="ubaka_attendance"
DB_USER="postgres"
SCHEMA_FILE="backend/database/schema.sql"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "[ERROR] PostgreSQL is not installed"
    echo "Please install PostgreSQL first:"
    echo "  Ubuntu/Debian: sudo apt install postgresql"
    echo "  macOS: brew install postgresql@14"
    exit 1
fi

echo "[OK] PostgreSQL is installed"
echo ""

# Check if PostgreSQL is running
if ! pg_isready -q; then
    echo "[ERROR] PostgreSQL is not running"
    echo "Please start PostgreSQL:"
    echo "  Ubuntu/Debian: sudo systemctl start postgresql"
    echo "  macOS: brew services start postgresql@14"
    exit 1
fi

echo "[OK] PostgreSQL is running"
echo ""

# Check if database already exists
if psql -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    echo "[WARN] Database '$DB_NAME' already exists"
    read -p "Do you want to drop and recreate it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Dropping existing database..."
        dropdb -U $DB_USER $DB_NAME
        echo "[OK] Database dropped"
    else
        echo "[INFO] Keeping existing database"
        exit 0
    fi
fi

# Create database
echo "Creating database '$DB_NAME'..."
if createdb -U $DB_USER $DB_NAME; then
    echo "[OK] Database created successfully"
else
    echo "[ERROR] Failed to create database"
    exit 1
fi

echo ""

# Apply schema
if [ -f "$SCHEMA_FILE" ]; then
    echo "Applying database schema..."
    if psql -U $DB_USER -d $DB_NAME -f $SCHEMA_FILE > /dev/null; then
        echo "[OK] Schema applied successfully"
    else
        echo "[ERROR] Failed to apply schema"
        exit 1
    fi
else
    echo "[ERROR] Schema file not found: $SCHEMA_FILE"
    exit 1
fi

echo ""

# Verify tables
echo "Verifying tables..."
TABLE_COUNT=$(psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo "[OK] Created $TABLE_COUNT tables"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Database setup complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo "Tables: $TABLE_COUNT"
echo ""
echo "You can now start the application:"
echo "  ./start-dev.sh"
echo ""
