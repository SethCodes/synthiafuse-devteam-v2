#!/bin/bash

# Workflow Coordinator - Dev → QA → Code Review Loop Automation
# Monitors STATUS files and automatically triggers appropriate agents
# Usage: ./workflow-coordinator.sh [company] [watch|once]

set -e

COMPANY="${1:-evolve}"
MODE="${2:-watch}"
WORKSPACE_DIR="./workspaces/$COMPANY"
CHECK_INTERVAL=10  # seconds

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}  Workflow Coordinator${NC}"
echo -e "${BLUE}  Dev → QA → Code Review Automation${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""
echo "Company: $COMPANY"
echo "Workspace: $WORKSPACE_DIR"
echo "Mode: $MODE"
echo ""

# Create workspace if doesn't exist
mkdir -p "$WORKSPACE_DIR"

# Function to extract current status from STATUS file
get_status() {
    local status_file=$1

    if [ ! -f "$status_file" ]; then
        echo "UNKNOWN"
        return
    fi

    # Look for "Current Status:" or "Status:" line
    grep -i "^Status:" "$status_file" | tail -1 | sed 's/.*Status:[[:space:]]*//' || echo "UNKNOWN"
}

# Function to get ticket ID from filename
get_ticket_id() {
    local filename=$(basename "$1")
    echo "${filename%-STATUS.md}"
}

# Function to trigger QA agent
trigger_qa_agent() {
    local ticket_id=$1
    local status_file=$2

    echo -e "${YELLOW}🔄 Triggering QA Agent for $ticket_id${NC}"

    # Update status to show QA is starting
    echo "" >> "$status_file"
    echo "---" >> "$status_file"
    echo "" >> "$status_file"
    echo "**QA Testing Initiated:** $(date '+%Y-%m-%d %H:%M:%S')" >> "$status_file"
    echo "**Agent:** QA Engineer (Automated)" >> "$status_file"
    echo "" >> "$status_file"

    # Here you would call the actual QA agent
    # For now, we'll simulate with a placeholder
    echo -e "${BLUE}  → QA Agent would be invoked here${NC}"
    echo -e "${BLUE}  → Agent: agents/qa-engineer.md${NC}"
    echo -e "${BLUE}  → Ticket: $ticket_id${NC}"
    echo ""

    # Placeholder: In real implementation, this would:
    # ./scripts/agent-communication.sh invoke qa-engineer "$COMPANY" "$ticket_id"
}

# Function to trigger Code Review agent
trigger_code_review() {
    local ticket_id=$1
    local status_file=$2

    echo -e "${YELLOW}🔄 Triggering Code Review for $ticket_id${NC}"

    # First, run automated code review
    local project_path="$WORKSPACE_DIR/${ticket_id%-*}"  # Extract project name from ticket
    if [ -d "$project_path" ]; then
        echo -e "${BLUE}  → Running automated code review checks...${NC}"
        ./scripts/code-review-automation.sh "$project_path" "$WORKSPACE_DIR/$ticket_id-code-review.md" || true
    fi

    # Update status
    echo "" >> "$status_file"
    echo "---" >> "$status_file"
    echo "" >> "$status_file"
    echo "**Code Review Initiated:** $(date '+%Y-%m-%d %H:%M:%S')" >> "$status_file"
    echo "**Automated Review:** See $ticket_id-code-review.md" >> "$status_file"
    echo "**Agent:** Code Reviewer (Automated)" >> "$status_file"
    echo "" >> "$status_file"

    echo -e "${BLUE}  → Code Review Agent would be invoked here${NC}"
    echo -e "${BLUE}  → Automated report: $WORKSPACE_DIR/$ticket_id-code-review.md${NC}"
    echo ""

    # Placeholder: In real implementation:
    # ./scripts/agent-communication.sh invoke code-reviewer "$COMPANY" "$ticket_id"
}

# Function to handle state transition
handle_state_transition() {
    local status_file=$1
    local current_status=$2
    local ticket_id=$(get_ticket_id "$status_file")

    echo -e "${GREEN}📋 Processing: $ticket_id${NC}"
    echo -e "${BLUE}   Status: $current_status${NC}"

    case "$current_status" in
        "IN_QA_TESTING")
            echo -e "${YELLOW}   → Action: Trigger QA Agent${NC}"
            trigger_qa_agent "$ticket_id" "$status_file"
            ;;
        "CODE_REVIEW")
            echo -e "${YELLOW}   → Action: Trigger Code Review${NC}"
            trigger_code_review "$ticket_id" "$status_file"
            ;;
        "FIXES_IN_PROGRESS")
            echo -e "${BLUE}   → Waiting for developer to complete fixes${NC}"
            ;;
        "RE_TESTING")
            echo -e "${YELLOW}   → Action: Re-run QA Tests${NC}"
            trigger_qa_agent "$ticket_id" "$status_file"
            ;;
        "READY_FOR_MERGE")
            echo -e "${GREEN}   ✅ Ready for merge - No action needed${NC}"
            ;;
        "DEPLOYED"|"CLOSED")
            echo -e "${GREEN}   ✅ Complete - No action needed${NC}"
            ;;
        *)
            echo -e "${BLUE}   → Status: $current_status (no automatic action)${NC}"
            ;;
    esac
    echo ""
}

# Function to scan workspace for STATUS files
scan_workspace() {
    echo -e "${BLUE}🔍 Scanning workspace for STATUS files...${NC}"
    echo ""

    local processed=0

    for status_file in "$WORKSPACE_DIR"/*-STATUS.md; do
        if [ -f "$status_file" ]; then
            local current_status=$(get_status "$status_file")
            handle_state_transition "$status_file" "$current_status"
            processed=$((processed + 1))
        fi
    done

    if [ $processed -eq 0 ]; then
        echo -e "${YELLOW}No STATUS files found in workspace${NC}"
        echo ""
    else
        echo -e "${GREEN}Processed $processed STATUS file(s)${NC}"
        echo ""
    fi
}

# Main execution
if [ "$MODE" = "watch" ]; then
    echo -e "${GREEN}👀 Watching for STATUS file changes...${NC}"
    echo -e "${BLUE}Press Ctrl+C to stop${NC}"
    echo ""

    while true; do
        scan_workspace
        echo -e "${BLUE}Waiting $CHECK_INTERVAL seconds before next check...${NC}"
        echo ""
        sleep $CHECK_INTERVAL
    done
else
    # Run once
    scan_workspace
fi

echo -e "${GREEN}Workflow Coordinator finished${NC}"
