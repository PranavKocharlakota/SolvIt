"""FastAPI entry point."""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from app.routes import recognize, solve, describe, ws

app = FastAPI(title="Math Whiteboard AI", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://solvit.onrender.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(recognize.router, prefix="/api")
app.include_router(describe.router, prefix="/api")
app.include_router(solve.router, prefix="/api")
app.include_router(ws.router)


@app.get("/health")
async def health():
    return {"status": "ok", "backend": "python-fastapi"}
