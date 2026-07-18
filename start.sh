#!/bin/bash
# Start both backend and frontend dev servers
# Prerequisite: RSSHub running on localhost:1200
#   docker run -d --name rsshub -p 1200:1200 diygod/rsshub
# Or set RSSHUB_BASE in backend/.env to a public instance

# Ensure RSSHub is accessible
RSSHUB_BASE="${RSSHUB_BASE:-http://localhost:1200}"
if ! curl -s "${RSSHUB_BASE}/jinse/timeline" > /dev/null 2>&1; then
  echo "[WARN] RSSHub not reachable at ${RSSHUB_BASE}"
  echo "       Start one with: docker run -d --name rsshub -p 1200:1200 diygod/rsshub"
  echo "       Or set RSSHUB_BASE in backend/.env to a public RSSHub instance"
  echo ""
fi

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
