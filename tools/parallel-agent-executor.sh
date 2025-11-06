#!/bin/bash

# Parallel Agent Execution Framework
# Allows multiple independent agents to work concurrently on different sub-tasks
# Usage: ./parallel-agent-executor.sh <task-config-json>

set -e

TASK_CONFIG="${1:-task-config.json}"
MAX_PARALLEL="${2:-3}"  # Max concurrent agents
RESULTS_DIR="./workspaces/parallel-results"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}  Parallel Agent Executor${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""
echo "Task Config: $TASK_CONFIG"
echo "Max Parallel: $MAX_PARALLEL"
echo "Results Dir: $RESULTS_DIR"
echo ""

# Create results directory
mkdir -p "$RESULTS_DIR"

# Check if jq is available for JSON parsing
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is required but not installed${NC}"
    echo "Install with: apt-get install jq (Linux) or brew install jq (Mac)"
    exit 1
fi

# Function to execute a single agent task
execute_agent_task() {
    local task_id=$1
    local agent_type=$2
    local task_description=$3
    local company=$4
    local ticket_id=$5

    local log_file="$RESULTS_DIR/${task_id}.log"
    local result_file="$RESULTS_DIR/${task_id}.result"

    echo -e "${BLUE}[${task_id}] Starting agent: $agent_type${NC}" | tee -a "$log_file"
    echo -e "${BLUE}[${task_id}] Description: $task_description${NC}" | tee -a "$log_file"
    echo ""

    # Record start time
    local start_time=$(date +%s)

    # Simulate agent execution (replace with actual agent invocation)
    # In real implementation:
    # ./scripts/agent-communication.sh invoke "$agent_type" "$company" "$ticket_id" "$task_description"

    echo -e "${YELLOW}[${task_id}] Agent $agent_type working on: $task_description${NC}" | tee -a "$log_file"

    # Simulate work (replace with actual execution)
    sleep $((RANDOM % 5 + 2))  # Random 2-7 seconds

    # Record end time
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    # Create result JSON
    cat > "$result_file" << EOF
{
  "task_id": "$task_id",
  "agent_type": "$agent_type",
  "description": "$task_description",
  "company": "$company",
  "ticket_id": "$ticket_id",
  "status": "completed",
  "duration_seconds": $duration,
  "started_at": "$(date -d @$start_time '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date -r $start_time '+%Y-%m-%d %H:%M:%S')",
  "completed_at": "$(date -d @$end_time '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date -r $end_time '+%Y-%m-%d %H:%M:%S')"
}
EOF

    echo -e "${GREEN}[${task_id}] ✅ Completed in ${duration}s${NC}" | tee -a "$log_file"
    return 0
}

# Function to execute tasks in parallel
execute_parallel() {
    local config_file=$1

    if [ ! -f "$config_file" ]; then
        echo -e "${RED}Error: Config file not found: $config_file${NC}"
        exit 1
    fi

    # Parse tasks from JSON
    local task_count=$(jq '.tasks | length' "$config_file")
    echo -e "${BLUE}Found $task_count tasks to execute${NC}"
    echo ""

    # Track running processes
    local pids=()
    local task_index=0

    # Launch tasks up to MAX_PARALLEL
    while [ $task_index -lt $task_count ]; do
        # Wait if we're at max parallel
        while [ ${#pids[@]} -ge $MAX_PARALLEL ]; do
            # Check for completed processes
            for i in "${!pids[@]}"; do
                if ! kill -0 "${pids[$i]}" 2>/dev/null; then
                    # Process completed
                    wait "${pids[$i]}"
                    unset 'pids[$i]'
                fi
            done
            sleep 0.5
        done

        # Get task details from JSON
        local task_id=$(jq -r ".tasks[$task_index].id" "$config_file")
        local agent_type=$(jq -r ".tasks[$task_index].agent" "$config_file")
        local description=$(jq -r ".tasks[$task_index].description" "$config_file")
        local company=$(jq -r ".company // \"evolve\"" "$config_file")
        local ticket_id=$(jq -r ".ticket_id // \"UNKNOWN\"" "$config_file")

        # Launch task in background
        execute_agent_task "$task_id" "$agent_type" "$description" "$company" "$ticket_id" &
        pids+=($!)

        echo -e "${YELLOW}Launched task $task_id (PID: ${pids[-1]})${NC}"
        task_index=$((task_index + 1))
    done

    # Wait for all remaining tasks
    echo ""
    echo -e "${BLUE}Waiting for all tasks to complete...${NC}"
    for pid in "${pids[@]}"; do
        wait "$pid"
    done

    echo ""
    echo -e "${GREEN}✅ All tasks completed${NC}"
}

# Function to generate summary report
generate_summary() {
    echo ""
    echo -e "${BLUE}=====================================${NC}"
    echo -e "${BLUE}  Execution Summary${NC}"
    echo -e "${BLUE}=====================================${NC}"
    echo ""

    local total_tasks=0
    local completed_tasks=0
    local total_duration=0

    for result_file in "$RESULTS_DIR"/*.result; do
        if [ -f "$result_file" ]; then
            total_tasks=$((total_tasks + 1))

            local status=$(jq -r '.status' "$result_file")
            if [ "$status" = "completed" ]; then
                completed_tasks=$((completed_tasks + 1))
            fi

            local duration=$(jq -r '.duration_seconds' "$result_file")
            total_duration=$((total_duration + duration))
        fi
    done

    echo "Total Tasks: $total_tasks"
    echo "Completed: $completed_tasks"
    echo "Total Duration: ${total_duration}s"

    if [ $total_tasks -gt 0 ]; then
        local avg_duration=$((total_duration / total_tasks))
        echo "Average Duration: ${avg_duration}s"
    fi

    echo ""
    echo "Results saved to: $RESULTS_DIR"
    echo ""

    # List individual results
    echo -e "${BLUE}Individual Task Results:${NC}"
    for result_file in "$RESULTS_DIR"/*.result; do
        if [ -f "$result_file" ]; then
            local task_id=$(jq -r '.task_id' "$result_file")
            local agent=$(jq -r '.agent_type' "$result_file")
            local duration=$(jq -r '.duration_seconds' "$result_file")
            echo -e "  ${GREEN}✓${NC} $task_id ($agent) - ${duration}s"
        fi
    done
    echo ""
}

# Create example config if needed
create_example_config() {
    cat > "task-config-example.json" << 'EOF'
{
  "company": "evolve",
  "ticket_id": "EG-2082",
  "description": "Multi-task parallel execution example",
  "tasks": [
    {
      "id": "task-1",
      "agent": "backend-dev",
      "description": "Implement API endpoint for video provider",
      "dependencies": []
    },
    {
      "id": "task-2",
      "agent": "frontend-dev",
      "description": "Create UI components for video selection",
      "dependencies": []
    },
    {
      "id": "task-3",
      "agent": "qa-engineer",
      "description": "Write test plan for video system",
      "dependencies": []
    },
    {
      "id": "task-4",
      "agent": "devops",
      "description": "Set up AWS S3 bucket for video storage",
      "dependencies": []
    },
    {
      "id": "task-5",
      "agent": "backend-dev",
      "description": "Implement caching layer for video metadata",
      "dependencies": ["task-1"]
    }
  ]
}
EOF
    echo -e "${GREEN}Created example config: task-config-example.json${NC}"
}

# Main execution
if [ "$TASK_CONFIG" = "--example" ]; then
    create_example_config
    exit 0
fi

if [ ! -f "$TASK_CONFIG" ]; then
    echo -e "${YELLOW}Config file not found. Creating example...${NC}"
    create_example_config
    echo ""
    echo -e "${BLUE}Usage:${NC}"
    echo "  $0 task-config.json [max-parallel]"
    echo ""
    echo -e "${BLUE}Example:${NC}"
    echo "  $0 task-config-example.json 3"
    echo ""
    exit 1
fi

# Execute tasks
execute_parallel "$TASK_CONFIG"

# Generate summary
generate_summary

echo -e "${GREEN}Parallel execution complete!${NC}"
