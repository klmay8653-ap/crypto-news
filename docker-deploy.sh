#!/bin/bash
set -e

# ─── Color helpers ───────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $1"; }
err()  { echo -e "${RED}[ERR]${NC}   $1"; }

# ─── Step 1: Check Docker ────────────────────────────────────
echo ""
echo -e "${CYAN}======================================${NC}"
echo -e "${CYAN}  Crypto H5 Docker Deploy${NC}"
echo -e "${CYAN}======================================${NC}"
echo ""

if ! command -v docker &> /dev/null; then
    err "Docker not installed. Please install Docker first."
    exit 1
fi
log "docker found: $(docker --version)"

# Detect docker compose (plugin v2: "docker compose", standalone v1: "docker-compose")
if docker compose version &> /dev/null; then
    COMPOSE="docker compose"
elif command -v docker-compose &> /dev/null; then
    COMPOSE="docker-compose"
else
    err "docker compose not available. Please install Docker Compose."
    exit 1
fi
log "docker compose found: $($COMPOSE version)"

# ─── Step 2: Check existing images ────────────────────────────
echo ""
log "Checking existing images..."
IMAGES=$(docker images --format "{{.Repository}}:{{.Tag}}" 2>/dev/null | grep "crypto" || true)

if [ -n "$IMAGES" ]; then
    warn "Found existing crypto-related images:"
    echo "$IMAGES" | sed 's/^/       /'
    echo ""
    read -rp "Rebuild images? [y/N] " REBUILD
    if [[ ! "$REBUILD" =~ ^[Yy]$ ]]; then
        log "Skipping build, using existing images."
    else
        BUILD=true
    fi
else
    log "No existing crypto images found."
    BUILD=true
fi

# ─── Step 3: Build ───────────────────────────────────────────
if [ "${BUILD:-false}" = true ]; then
    echo ""
    log "Building Docker images..."
    $COMPOSE build --no-cache
    log "Build complete."
fi

# ─── Step 4: Check running containers ─────────────────────────
RUNNING=$($COMPOSE ps --status running --format "{{.Service}}" 2>/dev/null || true)
if [ -n "$RUNNING" ]; then
    warn "Containers already running:"
    echo "$RUNNING" | sed 's/^/       /'
    echo ""
    read -rp "Restart services? [y/N] " RESTART
    if [[ "$RESTART" =~ ^[Yy]$ ]]; then
        log "Stopping existing containers..."
        $COMPOSE down
    else
        log "Services already running. Nothing to do."
        echo ""
        echo -e "  Frontend: ${CYAN}http://localhost:3080${NC}"
        echo -e "  Backend:  ${CYAN}http://localhost:3001${NC}"
        echo -e "  Health:   ${CYAN}http://localhost:3001/api/health${NC}"
        exit 0
    fi
fi

# ─── Step 5: Start services ──────────────────────────────────
echo ""
log "Starting services..."
$COMPOSE up -d

# ─── Step 6: Wait for ready ──────────────────────────────────
echo ""
log "Waiting for backend to be ready..."

MAX_WAIT=60
for i in $(seq 1 $MAX_WAIT); do
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        log "Backend is ready. (${i}s)"
        break
    fi
    if [ "$i" -eq "$MAX_WAIT" ]; then
        warn "Backend did not become ready within ${MAX_WAIT}s. Check logs: $COMPOSE logs backend"
    fi
    sleep 1
done

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  Services running!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "  Frontend: ${CYAN}http://localhost:3080${NC}"
echo -e "  Backend:  ${CYAN}http://localhost:3001${NC}"
echo -e "  RSSHub:   ${CYAN}http://localhost:1200${NC}  (internal only by default)"
echo -e "  Health:   ${CYAN}http://localhost:3001/api/health${NC}"
echo ""
echo "  Useful commands:"
echo "    $COMPOSE logs -f         # View all logs"
echo "    $COMPOSE logs -f rsshub  # View RSSHub logs"
echo "    $COMPOSE logs -f backend # View backend logs"
echo "    $COMPOSE ps              # Check status"
echo "    $COMPOSE down            # Stop all services"
echo ""
