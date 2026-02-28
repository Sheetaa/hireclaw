#!/bin/bash
# Test runner script - starts API server, runs tests, then stops server

cd "$(dirname "$0")"

# Start server in background
echo "Starting API server..."
pnpm dev &
SERVER_PID=$!

# Wait for server to be ready
echo "Waiting for server..."
for i in {1..30}; do
  if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "Server is ready!"
    break
  fi
  sleep 1
done

# Run tests
echo "Running tests..."
pnpm test
TEST_EXIT=$?

# Stop server
echo "Stopping server..."
kill $SERVER_PID 2>/dev/null

exit $TEST_EXIT
