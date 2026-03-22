"""Groq API client — full pipeline:
  Stage A (stroke_processor.py): deterministic geometry extraction
  Stage B (here): semantic labeling via vision model
  Reasoning gate: confidence check before drawing
  Action planning: structured draw actions → compiled to primitives
"""

import json
import math
import os
import re
from groq import Groq

_client: Groq | None = None


def get_client() -> Groq:
    global _client
    if _client is None:
        _client = Groq(api_key=os.environ["GROQ_API_KEY"])
    return _client


# ── Prompts ───────────────────────────────────────────────────────────────────

LIVE_DESCRIBE_PROMPT = """\
You are a live observer watching someone draw on a whiteboard.
Describe what you see in 1-2 plain sentences. Be specific and natural.
Works for anything: math, physics, doodles, diagrams, letters, art, shapes — anything.
Speak in present tense. If it's incomplete or unclear, describe what you can see so far.
Output only the description text. No JSON, no labels, no formatting.
"""

SEMANTIC_LABEL_PROMPT = """\
You are a visual analysis system for a general-purpose whiteboard.
Analyze the image and describe what is drawn. The content can be anything:
math, code, diagrams, art, text, flowcharts, mind maps, sketches, notes — anything.

Output raw JSON with exactly these keys:
{
  "description": "2-3 honest sentences describing what is drawn",
  "latex": "LaTeX string only if a clear mathematical equation is visible, otherwise null",
  "content_type": "plain English description of the content type, e.g. 'flowchart', 'portrait sketch', 'algebra equation'",
  "elements": [
    {"label": "short name of a notable thing", "detail": "optional extra detail or null"}
  ]
}

Rules:
- description: be specific and honest about whatever you see. Never force a math/science interpretation.
- content_type: plain English, not an enum. Examples: "doodle", "flowchart", "handwritten note",
  "quadratic equation", "free body diagram", "portrait", "bar chart", "mind map".
- elements: list the notable visible things (shapes, symbols, text regions, etc.). Keep it concise.
- latex: only if a mathematical expression is clearly written out. Otherwise null.
- Do NOT output any coordinates or numeric positions.
- Output raw JSON only. No markdown fences.
"""

REASONING_GATE_PROMPT = """\
You are a drawing decision system for a general-purpose whiteboard.
Given a solution/explanation step and the current canvas context, decide whether and what to draw.

Output JSON with EXACTLY these keys:
{
  "understanding_confidence": 0.85,
  "detected_problem_type": "quadratic graph analysis",
  "missing_information": ["exact equation unknown"],
  "intended_action": "mark vertex and draw axis of symmetry",
  "should_draw": true
}

Rules for should_draw:
- Set false if understanding_confidence < 0.50
- Set false if the step is pure text with no visual element (e.g. "recall Newton's 1st law")
- Set false if the required geometry cannot be determined from available information
- Otherwise set true

Be precise and honest. Output raw JSON only. No markdown.
"""

ACTION_PLAN_PROMPT = """\
You are a drawing planner for a general-purpose whiteboard.
You receive an explanation step, a description of what is on canvas, and style context.
Add minimal visual annotations to help explain the step — for any topic.

CRITICAL RULES:
1. Do NOT redraw things already on canvas.
2. Only ADD: labels, arrows, callouts, highlighted points, explanatory text, connectors.
3. All coordinates are 0–100 (0,0 = top-left; 100,100 = bottom-right).
4. Place additions in empty space outside the user's drawing area.
5. Prefer 2–5 precise additions. When in doubt, use draw_text.
6. Adapt to the content — annotate a flowchart differently from a sketch or equation.

Allowed action types:
  draw_point  → {"type":"draw_point","position":[x,y],"label":"name","color":"#dc2626","radius":1.5}
  draw_line   → {"type":"draw_line","from":[x1,y1],"to":[x2,y2],"style":"solid","label":"text","color":"#1d4ed8"}
  draw_arrow  → {"type":"draw_arrow","from":[x1,y1],"to":[x2,y2],"label":"text","color":"#16a34a"}
  draw_text   → {"type":"draw_text","position":[x,y],"text":"annotation","size":3.5,"color":"#111827","bold":false}
  draw_arc    → {"type":"draw_arc","center":[x,y],"radius":8,"from_angle":0,"to_angle":45,"label":"text","color":"#d97706"}

NOTE: draw_text containing equations or formulas will render as handwritten pen strokes.

Output: {"actions": [...]}
Output raw JSON only. No markdown.
"""

SOLVE_PROMPT = """\
You are a knowledgeable tutor. Given a description of what someone has drawn or written,
produce a clear step-by-step explanation or solution.

Output:
{
  "steps": [
    {
      "stepNumber": 1,
      "explanation": "specific explanation using actual values",
      "diagram": null,
      "equation": "equation or null"
    }
  ]
}
Always set diagram to null. Use actual values. Be quantitative.
Output raw JSON only. No markdown.
"""


# ── Helpers ───────────────────────────────────────────────────────────────────

def _strip_fences(text: str) -> str:
    return re.sub(r"^```(?:json)?\n?", "", text.strip()).rstrip("```").strip()


def _safe_json(raw: str, fallback: dict) -> dict:
    try:
        return json.loads(_strip_fences(raw))
    except json.JSONDecodeError:
        return fallback


# ── Stage B: Semantic labeling (vision model) ─────────────────────────────────

def recognize_image_semantic(
    image_base64: str,
    geometric_primitives: list[dict],
    delta_context: str = "",
) -> dict:
    """
    Two-stage recognition:
      Input:  raw PNG base64 + Stage-A geometric primitives
      Output: full SemanticScene dict
    """
    client = get_client()
    data_url = f"data:image/png;base64,{image_base64}"

    geom_summary = json.dumps(geometric_primitives, indent=2) if geometric_primitives else "[]"

    user_text = f"Geometric primitives extracted from strokes:\n{geom_summary}\n\n"
    if delta_context:
        user_text += f"CHANGE CONTEXT: {delta_context}\n\n"
    user_text += "Analyze this whiteboard and output the semantic scene JSON."

    resp = client.chat.completions.create(
        model="meta-llama/llama-4-scout-17b-16e-instruct",
        messages=[
            {"role": "system", "content": SEMANTIC_LABEL_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": data_url}},
                    {"type": "text", "text": user_text},
                ],
            },
        ],
        max_tokens=1024,
    )
    raw = resp.choices[0].message.content or "{}"
    parsed = _safe_json(raw, {})

    return {
        "description": str(parsed.get("description") or "Unable to recognize."),
        "latex": parsed.get("latex"),
        "content_type": str(parsed.get("content_type") or "unknown"),
        "elements": parsed.get("elements") or [],
    }


def solve_problem(recognition: dict, question: str | None = None) -> dict:
    """Run reasoning on structured recognition result."""
    client = get_client()
    context = json.dumps(recognition, indent=2)
    user_msg = f"Problem:\n{context}"
    if question:
        user_msg += f"\n\nFollow-up: {question}"

    resp = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": SOLVE_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        max_tokens=2048,
        response_format={"type": "json_object"},
    )
    raw = resp.choices[0].message.content or '{"steps":[]}'
    return _safe_json(raw, {
        "steps": [{"stepNumber": 1, "explanation": raw[:400], "diagram": None, "equation": None}]
    })


# ── Reasoning gate ────────────────────────────────────────────────────────────

def reason_about_step(
    step_description: str,
    scene_context: str,
    stroke_summary: str,
) -> dict:
    """
    Decide whether drawing is useful and what to draw.
    Returns ReasoningGate dict.
    """
    client = get_client()
    user_msg = (
        f"Step to illustrate: {step_description}\n\n"
        f"Existing scene:\n{scene_context}\n\n"
        f"Canvas: {stroke_summary}"
    )
    resp = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": REASONING_GATE_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        max_tokens=256,
        response_format={"type": "json_object"},
    )
    raw = resp.choices[0].message.content or "{}"
    return _safe_json(raw, {
        "understanding_confidence": 0.5,
        "detected_problem_type": "unknown",
        "missing_information": [],
        "intended_action": "draw diagram",
        "should_draw": True,
    })


# ── Action planning ───────────────────────────────────────────────────────────

def plan_drawing_actions(
    step_description: str,
    scene: dict,
    style_features=None,
    stroke_bounds=None,
    stroke_count: int = 0,
) -> dict:
    """
    Generate a structured action plan for annotating the existing drawing.
    Returns {"actions": [...]}
    """
    client = get_client()
    context_parts: list[str] = []

    if scene:
        scene_summary = {
            "problem_type": scene.get("problem_type"),
            "dominant_type": (scene.get("features") or {}).get("dominant_type"),
            "coordinate_system_detected": (scene.get("coordinate_system") or {}).get("detected", False),
            "curve_semantics": [c.get("semantic") for c in scene.get("curves", [])],
            "features": scene.get("features") or {},
        }
        context_parts.append(f"Existing scene:\n{json.dumps(scene_summary, indent=2)}")

    if stroke_bounds:
        b = stroke_bounds
        context_parts.append(
            f"Drawing occupies x=[{b.normMinX:.0f},{b.normMaxX:.0f}] "
            f"y=[{b.normMinY:.0f},{b.normMaxY:.0f}] — place additions OUTSIDE this box."
        )

    if style_features:
        context_parts.append(
            f"Match user style: stroke width≈{style_features.avgWidth:.1f}, "
            f"primary color {style_features.dominantColor}."
        )

    if stroke_count > 0:
        context_parts.append(
            f"User has {stroke_count} pen strokes on canvas. "
            f"AUGMENT ONLY — do not redraw existing content."
        )

    user_msg = "\n".join(context_parts) + f"\n\nStep to illustrate: {step_description}"

    resp = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": ACTION_PLAN_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        max_tokens=1024,
        response_format={"type": "json_object"},
    )
    raw = resp.choices[0].message.content or '{"actions":[]}'
    return _safe_json(raw, {"actions": []})


# ── Action compiler ───────────────────────────────────────────────────────────

def _xy(lst, dx: float = 50.0, dy: float = 50.0) -> tuple[float, float]:
    """Safely extract (x, y) from a list that may be None or have < 2 elements."""
    if not lst or not isinstance(lst, (list, tuple)):
        return dx, dy
    x = float(lst[0]) if len(lst) > 0 else dx
    y = float(lst[1]) if len(lst) > 1 else dy
    return x, y


def compile_actions_to_diagram(action_plan: dict) -> dict:
    """
    Convert a structured action plan into a FreeDiagram primitives list.
    This is deterministic — no LLM involvement.
    """
    primitives: list[dict] = []

    for action in action_plan.get("actions", []):
        if not isinstance(action, dict):
            continue
        try:
            t = action.get("type", "")
            color = action.get("color", "#475569")

            if t == "draw_point":
                cx, cy = _xy(action.get("position"), 50, 50)
                r = float(action.get("radius") or 1.5)
                primitives.append({
                    "type": "circle", "cx": cx, "cy": cy, "r": r,
                    "color": color, "fill": color, "width": 1,
                })
                if action.get("label"):
                    primitives.append({
                        "type": "text", "x": cx + r + 1.5, "y": cy - r - 1.5,
                        "content": str(action["label"]), "size": 3.5, "color": color,
                    })

            elif t == "draw_line":
                x1, y1 = _xy(action.get("from"), 10, 50)
                x2, y2 = _xy(action.get("to"), 90, 50)
                primitives.append({
                    "type": "line",
                    "x1": x1, "y1": y1, "x2": x2, "y2": y2,
                    "color": color, "width": 1.5,
                    "dashed": action.get("style") == "dashed",
                })
                if action.get("label"):
                    primitives.append({
                        "type": "text", "x": (x1 + x2) / 2 + 2, "y": (y1 + y2) / 2 - 4,
                        "content": str(action["label"]), "size": 3.5, "color": color,
                    })

            elif t == "draw_arrow":
                x1, y1 = _xy(action.get("from"), 50, 80)
                x2, y2 = _xy(action.get("to"), 50, 20)
                primitives.append({
                    "type": "arrow",
                    "x1": x1, "y1": y1, "x2": x2, "y2": y2,
                    "color": color, "width": 2,
                    "label": str(action.get("label") or ""),
                })

            elif t == "draw_text":
                px, py = _xy(action.get("position"), 50, 50)
                text = str(action.get("text") or "")
                size = float(action.get("size") or 3.5)
                txt_color = action.get("color") or "#111827"
                use_handwrite = bool(
                    re.search(r'[=+\-×÷/^²³√πθαβμσωΔΣλ∞∫∂≈]', text) or
                    (re.search(r'\d', text) and re.search(r'[a-zA-Z]', text))
                )
                primitives.append({
                    "type": "handwrite" if use_handwrite else "text",
                    "x": px, "y": py,
                    "content": text,
                    "size": size,
                    "color": txt_color,
                    **({"bold": bool(action.get("bold"))} if not use_handwrite else {}),
                })

            elif t == "draw_arc":
                cx, cy = _xy(action.get("center"), 50, 50)
                r = float(action.get("radius") or 8)
                from_angle = float(action.get("from_angle") or 0)
                to_angle = float(action.get("to_angle") or 45)
                primitives.append({
                    "type": "arc",
                    "cx": cx, "cy": cy, "r": r,
                    "startAngle": from_angle, "endAngle": to_angle,
                    "color": color, "width": 1.5,
                })
                if action.get("label"):
                    mid_rad = math.radians((from_angle + to_angle) / 2)
                    primitives.append({
                        "type": "text",
                        "x": cx + (r + 5) * math.cos(mid_rad),
                        "y": cy + (r + 5) * math.sin(mid_rad),
                        "content": str(action["label"]), "size": 3.5, "color": color,
                    })

        except Exception:
            continue  # skip malformed actions, never crash

    return {"type": "free", "primitives": primitives}


# ── Live description (lightweight, any content) ────────────────────────────────

def describe_image(image_base64: str) -> str:
    """
    Fast live description of whatever is on the whiteboard.
    Returns plain text — no JSON parsing, no structured output.
    """
    client = get_client()
    data_url = f"data:image/png;base64,{image_base64}"
    resp = client.chat.completions.create(
        model="meta-llama/llama-4-scout-17b-16e-instruct",
        messages=[
            {"role": "system", "content": LIVE_DESCRIBE_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": data_url}},
                    {"type": "text", "text": "What do you see being drawn?"},
                ],
            },
        ],
        max_tokens=120,
    )
    return (resp.choices[0].message.content or "").strip()


# ── Legacy wrapper (kept for solve pipeline) ──────────────────────────────────

def recognize_image(image_base64: str) -> dict:
    """Lightweight recognition — no stroke context."""
    return recognize_image_semantic(image_base64, [])


def generate_diagram(
    step_description: str,
    style_features=None,
    stroke_bounds=None,
    stroke_count: int = 0,
    semantic_scene: dict | None = None,
) -> dict:
    """
    Full draw-step pipeline:
      reason → plan → compile
    Falls back to empty diagram if confidence is too low.
    """
    scene = semantic_scene or {}
    stroke_summary = f"{stroke_count} pen strokes" if stroke_count else "empty canvas"
    if stroke_bounds:
        b = stroke_bounds
        stroke_summary += (
            f", drawing region x=[{b.normMinX:.0f},{b.normMaxX:.0f}]"
            f" y=[{b.normMinY:.0f},{b.normMaxY:.0f}]"
        )

    gate = reason_about_step(step_description, json.dumps(scene), stroke_summary)
    if not gate.get("should_draw", True) or gate.get("understanding_confidence", 1.0) < 0.45:
        return {"type": "free", "primitives": []}

    action_plan = plan_drawing_actions(
        step_description, scene, style_features, stroke_bounds, stroke_count
    )
    return compile_actions_to_diagram(action_plan)
