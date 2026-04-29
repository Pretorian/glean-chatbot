#!/bin/bash

#
# Latency Checker - Monitor RAG pipeline performance
#
# Usage:
#   npm run latency              # Single test
#   npm run latency:stats        # Run 5 tests with statistics
#   npm run latency:watch        # Continuous monitoring
#

set -e

# Configuration
API_BASE="http://localhost:3001"
DEFAULT_QUESTION="What is our remote work policy?"
LOG_DIR="logs/latency"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Parse arguments
RUNS=1
SAVE_LOG=false
WATCH_MODE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --runs)
      RUNS="$2"
      shift 2
      ;;
    --log)
      SAVE_LOG=true
      shift
      ;;
    --watch)
      WATCH_MODE=true
      shift
      ;;
    --help)
      cat << 'HELP'
Latency Checker for Glean RAG Pipeline

Usage:
  npm run latency              # Single test
  npm run latency:stats        # 5 runs with statistics + log file
  npm run latency:watch        # Continuous monitoring

Options:
  --runs N    Run N tests and show statistics
  --log       Save results to logs/latency/
  --watch     Continuous monitoring mode
  --help      Show this help

Examples:
  ./scripts/check-latency.sh
  ./scripts/check-latency.sh --runs 10 --log
  ./scripts/check-latency.sh --watch
HELP
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Create log directory if needed
if [ "$SAVE_LOG" = true ]; then
  mkdir -p "$LOG_DIR"
  LOG_FILE="$LOG_DIR/latency_$TIMESTAMP.log"
fi

# Test full RAG
test_full_rag() {
  local response=$(curl -s -X POST "$API_BASE/api/ask" \
    -H "Content-Type: application/json" \
    -d "{\"question\": \"$DEFAULT_QUESTION\", \"maxSources\": 5}" \
    --max-time 60 2>&1)

  if echo "$response" | jq -e '.meta.latencyMs' > /dev/null 2>&1; then
    echo "$response" | jq -r '[.meta.latencyMs.searchMs, .meta.latencyMs.chatMs, .meta.latencyMs.totalMs, .meta.retrievalCount] | @tsv'
  else
    echo "ERROR\tERROR\tERROR\tERROR"
  fi
}

# Test search-only
test_search_only() {
  local response=$(curl -s -X POST "$API_BASE/api/search" \
    -H "Content-Type: application/json" \
    -d '{"query": "remote work policy", "maxResults": 5}' 2>&1)

  if echo "$response" | jq -e '.meta.latencyMs' > /dev/null 2>&1; then
    echo "$response" | jq -r '[.meta.latencyMs, (.results.results | length)] | @tsv'
  else
    echo "ERROR\tERROR"
  fi
}

# Print header
print_header() {
  echo ""
  echo "╔══════════════════════════════════════════════════════════════════╗"
  echo "║  📊 Glean RAG Latency Check - $(date +'%Y-%m-%d %H:%M:%S')       ║"
  echo "╚══════════════════════════════════════════════════════════════════╝"
  echo ""
}

# Single test
run_single_test() {
  print_header

  echo "═══════════════════════════════════════════════════════════════════"
  echo "  Test 1: Full RAG Pipeline (Search + Chat)"
  echo "═══════════════════════════════════════════════════════════════════"
  echo ""
  echo "Testing..."

  IFS=$'\t' read -r search_ms chat_ms total_ms count <<< "$(test_full_rag)"

  if [ "$search_ms" != "ERROR" ]; then
    local search_s=$(echo "scale=2; $search_ms / 1000" | bc)
    local chat_s=$(echo "scale=2; $chat_ms / 1000" | bc)
    local total_s=$(echo "scale=2; $total_ms / 1000" | bc)
    local chat_pct=$(echo "scale=1; $chat_ms * 100 / $total_ms" | bc)

    echo "✅ Success"
    echo ""
    echo "  Component Breakdown:"
    echo "  🔍 Search API:  ${search_ms}ms (${search_s}s)"
    echo "  🤖 Chat API:    ${chat_ms}ms (${chat_s}s) - ${chat_pct}% of total"
    echo "  ⏱️  Total:       ${total_ms}ms (${total_s}s)"
    echo ""
    echo "  Retrieved: $count documents"
  else
    echo "❌ Failed - timeout or error"
  fi

  echo ""
  echo "═══════════════════════════════════════════════════════════════════"
  echo "  Test 2: Search-Only Mode"
  echo "═══════════════════════════════════════════════════════════════════"
  echo ""
  echo "Testing..."

  IFS=$'\t' read -r so_ms so_count <<< "$(test_search_only)"

  if [ "$so_ms" != "ERROR" ]; then
    local so_s=$(echo "scale=2; $so_ms / 1000" | bc)
    echo "✅ Success"
    echo ""
    echo "  ⏱️  Latency: ${so_ms}ms (${so_s}s)"
    echo "  Results: $so_count documents"
  else
    echo "❌ Failed"
  fi

  # Comparison
  if [ "$search_ms" != "ERROR" ] && [ "$so_ms" != "ERROR" ]; then
    local speedup=$(echo "scale=0; $total_ms / $so_ms" | bc)

    echo ""
    echo "═══════════════════════════════════════════════════════════════════"
    echo "  Performance Comparison"
    echo "═══════════════════════════════════════════════════════════════════"
    echo ""
    echo "  Full RAG:      ${total_ms}ms (${total_s}s)"
    echo "  Search-Only:   ${so_ms}ms (${so_s}s)"
    echo ""
    echo "  Speed improvement: ${speedup}x faster with search-only"
  fi

  echo ""

  # Log
  if [ "$SAVE_LOG" = true ]; then
    {
      echo "Timestamp: $(date -Iseconds)"
      echo "Full RAG: search=${search_ms}ms chat=${chat_ms}ms total=${total_ms}ms"
      echo "Search-Only: ${so_ms}ms"
      echo ""
    } >> "$LOG_FILE"
  fi
}

# Multiple tests with statistics
run_multiple_tests() {
  print_header

  echo "Running $RUNS tests..."
  echo ""

  # Temporary file for results
  TEMP_FILE=$(mktemp)

  local success=0
  local failures=0

  for i in $(seq 1 $RUNS); do
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Run $i of $RUNS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    IFS=$'\t' read -r search_ms chat_ms total_ms count <<< "$(test_full_rag)"

    if [ "$search_ms" != "ERROR" ]; then
      echo "$search_ms $chat_ms $total_ms" >> "$TEMP_FILE"
      local total_s=$(echo "scale=2; $total_ms / 1000" | bc)
      echo "  ✅ Search: ${search_ms}ms | Chat: ${chat_ms}ms | Total: ${total_ms}ms (${total_s}s)"
      ((success++))
    else
      echo "  ❌ Timeout or error"
      ((failures++))
    fi

    [ $i -lt $RUNS ] && sleep 2
  done

  echo ""
  echo "═══════════════════════════════════════════════════════════════════"
  echo "  Statistics ($RUNS runs)"
  echo "═══════════════════════════════════════════════════════════════════"
  echo ""

  if [ $success -gt 0 ]; then
    # Calculate stats using awk
    awk '{
      search += $1; chat += $2; total += $3
      if (NR == 1 || $1 < search_min) search_min = $1
      if (NR == 1 || $1 > search_max) search_max = $1
      if (NR == 1 || $2 < chat_min) chat_min = $2
      if (NR == 1 || $2 > chat_max) chat_max = $2
      if (NR == 1 || $3 < total_min) total_min = $3
      if (NR == 1 || $3 > total_max) total_max = $3
    }
    END {
      print "Search API:"
      printf "  Avg: %.0fms  Min: %.0fms  Max: %.0fms\n", search/NR, search_min, search_max
      print ""
      print "Chat API:"
      printf "  Avg: %.0fms (%.1fs)  Min: %.0fms  Max: %.0fms\n", chat/NR, chat/NR/1000, chat_min, chat_max
      print ""
      print "Total:"
      printf "  Avg: %.0fms (%.1fs)  Min: %.0fms  Max: %.0fms\n", total/NR, total/NR/1000, total_min, total_max
    }' "$TEMP_FILE"

    echo ""
    local success_rate=$(echo "scale=1; $success * 100 / $RUNS" | bc)
    echo "Success Rate: ${success_rate}% ($success/$RUNS)"

    # Log summary
    if [ "$SAVE_LOG" = true ]; then
      {
        echo "=== Summary of $RUNS runs ==="
        echo "Timestamp: $(date -Iseconds)"
        awk '{search += $1; chat += $2; total += $3}
             END {
               printf "Search Avg: %.0fms\n", search/NR
               printf "Chat Avg: %.0fms\n", chat/NR
               printf "Total Avg: %.0fms\n", total/NR
             }' "$TEMP_FILE"
        echo "Success Rate: ${success_rate}%"
        echo "=========================================="
        echo ""
      } >> "$LOG_FILE"

      echo ""
      echo "Results saved to: $LOG_FILE"
    fi
  else
    echo "All tests failed!"
  fi

  rm -f "$TEMP_FILE"
  echo ""
}

# Watch mode
watch_mode() {
  echo "Starting continuous monitoring..."
  echo "Press Ctrl+C to stop"
  echo ""

  local iteration=1
  while true; do
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Iteration $iteration - $(date +'%H:%M:%S')"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    IFS=$'\t' read -r search_ms chat_ms total_ms count <<< "$(test_full_rag)"

    if [ "$search_ms" != "ERROR" ]; then
      local total_s=$(echo "scale=2; $total_ms / 1000" | bc)
      echo "  ✅ Search: ${search_ms}ms | Chat: ${chat_ms}ms | Total: ${total_ms}ms (${total_s}s)"
    else
      echo "  ❌ Timeout or error"
    fi

    echo ""
    echo "Waiting 30 seconds..."
    echo ""
    sleep 30
    ((iteration++))
  done
}

# Main
if [ "$WATCH_MODE" = true ]; then
  watch_mode
elif [ $RUNS -gt 1 ]; then
  run_multiple_tests
else
  run_single_test
fi

echo "═══════════════════════════════════════════════════════════════════"
echo "✅ Latency check complete"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
