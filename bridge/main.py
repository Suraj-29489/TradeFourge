"""
TradeFourge v4.0.1 — MT5 Bridge Microservice Main Entry Point
FastAPI Application, CORS Middleware, Router Mounts, and Scheduler Lifecycle.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from bridge.config import settings
from bridge.database import init_db
from bridge.scheduler import start_scheduler, stop_scheduler
from bridge.logger import log_event
from bridge.routes import auth, sync, status

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    log_event("SYSTEM_STARTUP", f"Starting TradeFourge MT5 Bridge Service v{settings.VERSION} on port {settings.PORT}")
    init_db()
    start_scheduler()
    yield
    # Shutdown
    stop_scheduler()
    log_event("SYSTEM_SHUTDOWN", "TradeFourge MT5 Bridge Service shut down cleanly.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Production MT5 Bridge Microservice for Exness Live Synchronization",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routes
app.include_router(auth.router)
app.include_router(sync.router)
app.include_router(status.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("bridge.main:app", host="0.0.0.0", port=settings.PORT, reload=False)
