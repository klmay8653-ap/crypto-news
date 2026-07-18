#!/bin/bash
# Start both backend and frontend dev servers

echo "=== Starting Backend (port 3000) ==="
cd backend && npx tsx src/index.ts &
BACKEND_PID=$!

echo "Waiting for backend to be ready..."
for i in $(seq 1 30); do
  if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "Backend ready."
    break
  fi
  sleep 1
done

echo "=== Starting Frontend (port 5173) ==="
cd frontend && npx vite --host &
FRONTEND_PID=$!

echo ""
echo "Backend:  http://localhost:3000"
echo "Frontend: http://localhost:5173"
echo "Health:   http://localhost:3000/api/health"
echo ""
echo "Press Ctrl+C to stop both"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
