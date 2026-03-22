#!/usr/bin/env python
"""Launch script: uvicorn app.main:app --reload --port 3002"""
import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=3002, reload=True)
