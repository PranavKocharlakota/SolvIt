from typing import Any, Optional
from pydantic import BaseModel, Field


# ── Recognition ───────────────────────────────────────────────────────────────

class RecognizedElement(BaseModel):
    """A single notable thing spotted in the drawing."""
    label: str              # e.g. "arrow", "circle", "text block", "stick figure"
    detail: Optional[str] = None  # e.g. "pointing right", "says 'hello'"


class RecognitionResult(BaseModel):
    description: str
    latex: Optional[str] = None          # only set if a clear equation is visible
    content_type: str = "unknown"        # free text: "flowchart", "math equation", etc.
    elements: list[RecognizedElement] = []


# ── Stroke input ──────────────────────────────────────────────────────────────

class StrokePoint(BaseModel):
    x: float
    y: float
    pressure: float = 0.5


class Stroke(BaseModel):
    points: list[StrokePoint]
    color: str = "#000000"
    width: float = 3.0
    tool: str = "pen"


class StrokeBounds(BaseModel):
    normMinX: float
    normMinY: float
    normMaxX: float
    normMaxY: float


class StrokeDelta(BaseModel):
    newStrokeCount: int = 0
    removedStrokeCount: int = 0
    changedRegion: Optional[StrokeBounds] = None


class RecognizeRequest(BaseModel):
    imageBase64: str
    strokes: Optional[list[Stroke]] = None
    delta: Optional[StrokeDelta] = None


# ── Solve ─────────────────────────────────────────────────────────────────────

class SolveRequest(BaseModel):
    recognition: RecognitionResult
    question: Optional[str] = None


class SolutionStep(BaseModel):
    stepNumber: int
    explanation: str
    diagram: Optional[dict] = None
    equation: Optional[str] = None
    sympy_result: Optional[str] = None


class SolveResponse(BaseModel):
    text: Optional[str] = None
    steps: Optional[list[SolutionStep]] = None


# ── WebSocket ─────────────────────────────────────────────────────────────────

class WSMessage(BaseModel):
    type: str
    payload: dict
