#!/bin/bash
#
# Run E2E tests in an isolated Docker environment
#
# Usage:
#   ./scripts/run-e2e-tests.sh              # Run all tests
#   ./scripts/run-e2e-tests.sh --headed     # Run with browser visible
#   ./scripts/run-e2e-tests.sh <test-file>  # Run specific test file
#
# Behind a proxy that replaces TLS certificates, point E2E_CA_FILE to the CA file.
# The file is mounted into the app container (docker-compose.test-ca.yml):
#   E2E_CA_FILE=/path/to/corporate-ca.pem ./scripts/run-e2e-tests.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_ARGS=(-f docker-compose.test.yml)
TEST_URL="http://localhost:3001"
PROJECT="yasp-test"

echo -e "${YELLOW}🧪 Yet Another Status Page E2E Test Runner${NC}"
echo ""

# Optional: mount a corporate CA into the app container (default: no CA, nothing changes)
if [ -n "${E2E_CA_FILE:-}" ]; then
  if [ ! -f "$E2E_CA_FILE" ]; then
    echo -e "${RED}❌ E2E_CA_FILE is set but the file does not exist: $E2E_CA_FILE${NC}"
    exit 1
  fi
  export E2E_CA_FILE
  COMPOSE_ARGS+=(-f docker-compose.test-ca.yml)
  echo "Using CA file: $E2E_CA_FILE"
fi

# Parse arguments
PLAYWRIGHT_ARGS="--project=chromium"
while [[ $# -gt 0 ]]; do
  case $1 in
    --headed)
      PLAYWRIGHT_ARGS="$PLAYWRIGHT_ARGS --headed"
      shift
      ;;
    --debug)
      PLAYWRIGHT_ARGS="$PLAYWRIGHT_ARGS --debug"
      shift
      ;;
    --ui)
      PLAYWRIGHT_ARGS="$PLAYWRIGHT_ARGS --ui"
      shift
      ;;
    *)
      PLAYWRIGHT_ARGS="$PLAYWRIGHT_ARGS $1"
      shift
      ;;
  esac
done

# Cleanup function
cleanup() {
  echo ""
  echo -e "${YELLOW}🧹 Cleaning up test environment...${NC}"
  docker compose -p "$PROJECT" "${COMPOSE_ARGS[@]}" down -v --remove-orphans 2>/dev/null || true
}

# Set trap for cleanup on exit
trap cleanup EXIT

# Step 1: Clean up any existing test containers
echo -e "${YELLOW}📦 Setting up test environment...${NC}"
docker compose -p "$PROJECT" "${COMPOSE_ARGS[@]}" down -v --remove-orphans 2>/dev/null || true

# Step 2: Build and start test containers
echo -e "${YELLOW}🐳 Starting test containers...${NC}"
docker compose -p "$PROJECT" "${COMPOSE_ARGS[@]}" up -d --build

# Step 3: Wait for the app to be healthy
echo -e "${YELLOW}⏳ Waiting for application to start (this may take a minute)...${NC}"

# Wait a bit for npm install to complete
sleep 30

MAX_RETRIES=60
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  RESPONSE=$(curl -s "$TEST_URL/api/health" 2>&1 || true)
  if echo "$RESPONSE" | grep -q '"ok"'; then
    echo -e "${GREEN}✓ Application is ready${NC}"
    break
  fi

  # Stop waiting when the app container has already exited (e.g. npm install failed)
  APP_ID=$(docker compose -p "$PROJECT" "${COMPOSE_ARGS[@]}" ps -a -q app 2>/dev/null || true)
  if [ -n "$APP_ID" ] && [ "$(docker inspect -f '{{.State.Running}}' "$APP_ID" 2>/dev/null)" = "false" ]; then
    echo -e "${RED}❌ The app container has stopped${NC}"
    echo ""
    echo "Container logs:"
    APP_LOGS=$(docker compose -p "$PROJECT" "${COMPOSE_ARGS[@]}" logs app --tail=100 2>&1)
    echo "$APP_LOGS"
    if echo "$APP_LOGS" | grep -q "UNABLE_TO_VERIFY_LEAF_SIGNATURE"; then
      echo ""
      echo -e "${YELLOW}Hint: a proxy replaces TLS certificates. Set E2E_CA_FILE to the CA file (see the header of this script).${NC}"
    fi
    exit 1
  fi
  
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}❌ Application failed to start after $MAX_RETRIES attempts${NC}"
    echo ""
    echo "Last response: $RESPONSE"
    echo ""
    echo "Container logs:"
    docker compose -p "$PROJECT" "${COMPOSE_ARGS[@]}" logs app --tail=100
    exit 1
  fi

  echo "  Waiting... ($RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done

# Step 4: Seed test data
echo ""
echo -e "${YELLOW}📦 Seeding test data...${NC}"
API_BASE="$TEST_URL" node tests/seed/seed-test-data.mjs

# Step 5: Run Playwright tests
echo ""
echo -e "${YELLOW}🎭 Running Playwright tests...${NC}"
echo ""

# Run tests with the test URL
PLAYWRIGHT_BASE_URL="$TEST_URL" CI= npx playwright test $PLAYWRIGHT_ARGS

TEST_EXIT_CODE=$?

# Step 6: Report results
echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}✅ All tests passed!${NC}"
else
  echo -e "${RED}❌ Some tests failed${NC}"
  echo ""
  echo "View the test report with: npm run test:e2e:report"
fi

exit $TEST_EXIT_CODE
