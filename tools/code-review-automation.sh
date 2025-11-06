#!/bin/bash

# Code Review Automation Script
# Automatically scans code for common issues before code review
# Usage: ./code-review-automation.sh <project-path> [output-file]

set -e

PROJECT_PATH="${1:-.}"
OUTPUT_FILE="${2:-code-review-report.md}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Colors for terminal output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_ISSUES=0
CRITICAL_ISSUES=0
WARNING_ISSUES=0

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  Code Review Automation Tool${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""
echo "Project: $PROJECT_PATH"
echo "Report: $OUTPUT_FILE"
echo "Timestamp: $TIMESTAMP"
echo ""

# Initialize report file
cat > "$OUTPUT_FILE" << EOF
# Automated Code Review Report

**Project:** $PROJECT_PATH
**Generated:** $TIMESTAMP
**Tool:** Code Review Automation v1.0

---

## Executive Summary

EOF

# Function to add issue to report
add_issue() {
    local severity=$1
    local category=$2
    local file=$3
    local line=$4
    local description=$5

    echo "**[$severity]** $category" >> "$OUTPUT_FILE"
    echo "- **File:** \`$file:$line\`" >> "$OUTPUT_FILE"
    echo "- **Issue:** $description" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"

    TOTAL_ISSUES=$((TOTAL_ISSUES + 1))
    if [ "$severity" = "CRITICAL" ]; then
        CRITICAL_ISSUES=$((CRITICAL_ISSUES + 1))
    else
        WARNING_ISSUES=$((WARNING_ISSUES + 1))
    fi
}

# Function to scan for debug statements
scan_debug_statements() {
    echo -e "${YELLOW}Scanning for debug statements...${NC}"
    echo "" >> "$OUTPUT_FILE"
    echo "## Debug Statements Found" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"

    local debug_count=0

    # C# Debug.Log
    while IFS=: read -r file line content; do
        if [ -n "$file" ]; then
            add_issue "WARNING" "Debug Statement" "$file" "$line" "Debug.Log statement found: ${content:0:60}..."
            debug_count=$((debug_count + 1))
        fi
    done < <(grep -rn "Debug\.Log\|Debug\.LogError\|Debug\.LogWarning" "$PROJECT_PATH" --include="*.cs" 2>/dev/null || true)

    # JavaScript console.log
    while IFS=: read -r file line content; do
        if [ -n "$file" ]; then
            add_issue "WARNING" "Debug Statement" "$file" "$line" "console.log statement found: ${content:0:60}..."
            debug_count=$((debug_count + 1))
        fi
    done < <(grep -rn "console\.log\|console\.error\|console\.warn" "$PROJECT_PATH" --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx" 2>/dev/null || true)

    if [ $debug_count -eq 0 ]; then
        echo "✅ No debug statements found." >> "$OUTPUT_FILE"
        echo "">> "$OUTPUT_FILE"
    fi

    echo -e "${GREEN}Found $debug_count debug statements${NC}"
}

# Function to scan for TODO comments
scan_todo_comments() {
    echo -e "${YELLOW}Scanning for TODO comments...${NC}"
    echo "" >> "$OUTPUT_FILE"
    echo "## TODO Comments Found" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"

    local todo_count=0

    while IFS=: read -r file line content; do
        if [ -n "$file" ]; then
            add_issue "WARNING" "TODO Comment" "$file" "$line" "Unresolved TODO: ${content:0:60}..."
            todo_count=$((todo_count + 1))
        fi
    done < <(grep -rn "//\s*TODO\|//\s*FIXME\|//\s*HACK\|/\*\s*TODO" "$PROJECT_PATH" --include="*.cs" --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx" 2>/dev/null || true)

    if [ $todo_count -eq 0 ]; then
        echo "✅ No TODO comments found." >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
    fi

    echo -e "${GREEN}Found $todo_count TODO comments${NC}"
}

# Function to scan for commented-out code
scan_commented_code() {
    echo -e "${YELLOW}Scanning for commented-out code blocks...${NC}"
    echo "" >> "$OUTPUT_FILE"
    echo "## Commented-Out Code Blocks" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"

    local commented_count=0

    # Look for multi-line comment blocks that look like code
    while IFS=: read -r file line content; do
        if [ -n "$file" ]; then
            # Check if line looks like commented code (has code patterns)
            if echo "$content" | grep -qE "//\s*(if|for|while|function|class|var|let|const|public|private|void|return)" 2>/dev/null; then
                add_issue "WARNING" "Commented Code" "$file" "$line" "Commented code block found: ${content:0:60}..."
                commented_count=$((commented_count + 1))
            fi
        fi
    done < <(grep -rn "^[[:space:]]*//.*" "$PROJECT_PATH" --include="*.cs" --include="*.js" --include="*.ts" 2>/dev/null | head -100 || true)

    if [ $commented_count -eq 0 ]; then
        echo "✅ No obvious commented-out code blocks found." >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
    fi

    echo -e "${GREEN}Found $commented_count potential commented code blocks${NC}"
}

# Function to scan for unused variables (simple heuristic)
scan_unused_code() {
    echo -e "${YELLOW}Scanning for potentially unused code...${NC}"
    echo "" >> "$OUTPUT_FILE"
    echo "## Potentially Unused Code" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"

    # This is a simplified check - would need proper AST analysis for accuracy
    echo "ℹ️  Full unused code detection requires AST analysis. Manual review recommended." >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
}

# Function to scan for hardcoded credentials
scan_credentials() {
    echo -e "${YELLOW}Scanning for hardcoded credentials...${NC}"
    echo "" >> "$OUTPUT_FILE"
    echo "## Security: Hardcoded Credentials Check" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"

    local cred_count=0

    # Look for common credential patterns
    while IFS=: read -r file line content; do
        if [ -n "$file" ]; then
            add_issue "CRITICAL" "Hardcoded Credential" "$file" "$line" "Potential credential found: ${content:0:60}..."
            cred_count=$((cred_count + 1))
        fi
    done < <(grep -rn "password\s*=\|apiKey\s*=\|secret\s*=\|token\s*=" "$PROJECT_PATH" --include="*.cs" --include="*.js" --include="*.ts" --include="*.json" 2>/dev/null | grep -v "\.env\|\.example\|test" || true)

    if [ $cred_count -eq 0 ]; then
        echo "✅ No obvious hardcoded credentials found." >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
    fi

    echo -e "${GREEN}Found $cred_count potential credential issues${NC}"
}

# Function to check file sizes
check_large_files() {
    echo -e "${YELLOW}Checking for unusually large files...${NC}"
    echo "" >> "$OUTPUT_FILE"
    echo "## Large Files Check" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"

    local large_count=0

    # Find code files larger than 500 lines
    while IFS= read -r file; do
        if [ -n "$file" ]; then
            lines=$(wc -l < "$file")
            if [ "$lines" -gt 500 ]; then
                add_issue "WARNING" "Large File" "$file" "N/A" "File has $lines lines (consider refactoring if over 500)"
                large_count=$((large_count + 1))
            fi
        fi
    done < <(find "$PROJECT_PATH" -type f \( -name "*.cs" -o -name "*.js" -o -name "*.ts" \) 2>/dev/null || true)

    if [ $large_count -eq 0 ]; then
        echo "✅ No unusually large files found." >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
    fi

    echo -e "${GREEN}Found $large_count large files${NC}"
}

# Run all scans
scan_debug_statements
scan_todo_comments
scan_commented_code
scan_unused_code
scan_credentials
check_large_files

# Generate summary
echo "" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "## Summary Statistics" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "- **Total Issues Found:** $TOTAL_ISSUES" >> "$OUTPUT_FILE"
echo "- **Critical Issues:** $CRITICAL_ISSUES" >> "$OUTPUT_FILE"
echo "- **Warnings:** $WARNING_ISSUES" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

if [ $CRITICAL_ISSUES -gt 0 ]; then
    echo "**Status:** ❌ CRITICAL ISSUES FOUND - Must be addressed before merge" >> "$OUTPUT_FILE"
elif [ $WARNING_ISSUES -gt 10 ]; then
    echo "**Status:** ⚠️  MANY WARNINGS - Recommend cleanup before merge" >> "$OUTPUT_FILE"
elif [ $WARNING_ISSUES -gt 0 ]; then
    echo "**Status:** ⚠️  Minor warnings - Review recommended" >> "$OUTPUT_FILE"
else
    echo "**Status:** ✅ CLEAN - No issues found" >> "$OUTPUT_FILE"
fi

echo "" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "*Generated by Code Review Automation Tool*" >> "$OUTPUT_FILE"

# Print summary to terminal
echo ""
echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  Code Review Complete${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""
echo -e "Total Issues: ${YELLOW}$TOTAL_ISSUES${NC}"
echo -e "Critical: ${RED}$CRITICAL_ISSUES${NC}"
echo -e "Warnings: ${YELLOW}$WARNING_ISSUES${NC}"
echo ""
echo "Report saved to: $OUTPUT_FILE"
echo ""

if [ $CRITICAL_ISSUES -gt 0 ]; then
    echo -e "${RED}❌ CRITICAL ISSUES FOUND - Review required${NC}"
    exit 1
elif [ $WARNING_ISSUES -gt 10 ]; then
    echo -e "${YELLOW}⚠️  Many warnings found - Cleanup recommended${NC}"
    exit 0
else
    echo -e "${GREEN}✅ Code review checks passed${NC}"
    exit 0
fi
