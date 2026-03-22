import json
from fastapi import APIRouter, HTTPException
from app.models.schemas import DrawStepRequest
from app.ai.groq_client import reason_about_step, plan_drawing_actions, compile_actions_to_diagram

router = APIRouter()


@router.post("/draw-step")
async def draw_step(req: DrawStepRequest):
    try:
        scene = req.semanticScene or {}

        # Build a human-readable canvas summary for the reasoning gate
        stroke_summary = f"{req.strokeCount} pen strokes" if req.strokeCount else "empty canvas"
        if req.strokeBounds:
            b = req.strokeBounds
            stroke_summary += (
                f", drawing region x=[{b.normMinX:.0f},{b.normMaxX:.0f}]"
                f" y=[{b.normMinY:.0f},{b.normMaxY:.0f}]"
            )

        # ── Reasoning gate ────────────────────────────────────────────────────
        gate = reason_about_step(
            req.stepDescription,
            json.dumps(scene, indent=2),
            stroke_summary,
        )

        confidence = float(gate.get("understanding_confidence", 1.0))
        if not gate.get("should_draw", True) or confidence < 0.45:
            # Return empty diagram — drawing would not be useful
            return {"type": "free", "primitives": [], "_gate": gate}

        # ── Action planning ───────────────────────────────────────────────────
        action_plan = plan_drawing_actions(
            req.stepDescription,
            scene,
            req.styleFeatures,
            req.strokeBounds,
            req.strokeCount,
        )

        # ── Deterministic compile ─────────────────────────────────────────────
        diagram = compile_actions_to_diagram(action_plan)
        return diagram

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
