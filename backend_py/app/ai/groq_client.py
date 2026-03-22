"""Groq API client — recognition and solve pipeline."""

import json
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
You are Echo, a friendly AI tutor watching someone draw on a whiteboard in real time.
Narrate what you see using first-person present tense, as if you're glancing at the board and casually telling the person what caught your eye.
Keep it warm and natural — 1 to 3 short sentences max.

Focus on high-level things only: shapes (circles, triangles, rectangles), variables (x, y, A), numbers, equations, words, arrows, diagrams — not low-level details like "curved strokes" or "line segments".
If only a rough sketch or partial drawing exists, describe the overall impression rather than dissecting each mark.

Examples of the tone:
- "I can see what looks like a right triangle with some variables next to it!"
- "Looks like you're writing out a quadratic equation — I see x² so far."
- "I'm seeing a circle with what might be a radius drawn inside."
- "Ooh, looks like a coordinate system is taking shape!"

Output only the spoken description. No JSON, no labels, no bullet points, no dollar signs, no LaTeX markup.
"""

SEMANTIC_LABEL_PROMPT = """\
You are a precise visual recognition system for a whiteboard. ACCURACY IS THE TOP PRIORITY.

Your ground truth is the pixel image. Any stroke metadata supplied is low-level supplementary data — the image always wins. Never let coordinate descriptions override what you can clearly see.

Pay special attention to symbols that look similar:
- AND gate (flat left side, D-shaped right) vs OR gate (curved left side, pointed right)
- NOR / NAND / XOR gates — each has a distinct silhouette
- Integral ∫ vs letter S; summation Σ vs letter E
- Union ∪ vs horseshoe; intersection ∩ vs upside-down horseshoe
- Less-than < vs left arrow; theta θ vs phi φ
- Plus + vs cross ×; equals = vs congruence ≡

Output raw JSON with exactly these keys:
{
  "description": "2-3 precise sentences. Name specific symbols by their correct name.",
  "latex": "LaTeX if a math expression is clearly visible, otherwise null",
  "content_type": "specific label, e.g. 'AND gate', 'quadratic equation', 'free body diagram', 'XOR gate'",
  "elements": [
    {"label": "exact name of element", "detail": "any relevant detail or null"}
  ]
}

Rules:
- If you see a logic gate, name the exact gate type. Do not generalise as 'gate' or 'shape'.
- If you see a math expression, capture it exactly in the latex field.
- description must be specific — not vague. Bad: "some shapes". Good: "An AND gate with two inputs and one output."
- description and element labels must be plain English prose — no LaTeX, no dollar signs, no backslashes.
- Do NOT output coordinates. Output raw JSON only. No markdown fences.
"""

SOLVE_PROMPT = """\
You are Echo, a friendly AI tutor. Someone drew something on a whiteboard and you have been given a description of it. Respond naturally and helpfully.

Pick the response style that fits the content — do NOT default to steps for everything:
- Simple concept, logic gate, symbol, diagram → a natural conversational paragraph or two
- Multi-step algebraic problem, proof, derivation → numbered steps make sense
- Quick factual answer → one or two sentences is enough

Honour the recognized content exactly. Do not reinterpret it.

Output JSON in one of these two forms:

Natural prose (use this most of the time):
{ "text": "Your natural response here.", "steps": null }

Numbered steps (only for genuinely multi-step math problems):
{ "text": null, "steps": [{ "stepNumber": 1, "explanation": "plain English", "equation": "LaTeX or null" }] }

Rules:
- text and explanation must be plain English — no dollar signs, no LaTeX, no backslashes.
- Put math notation only in the equation fields.
- Never force steps when a natural sentence or paragraph is more appropriate.
- Output raw JSON only. No markdown.
"""


# ── Helpers ───────────────────────────────────────────────────────────────────

def _strip_fences(text: str) -> str:
    return re.sub(r"^```(?:json)?\n?", "", text.strip()).rstrip("```").strip()


def _safe_json(raw: str, fallback: dict) -> dict:
    try:
        return json.loads(_strip_fences(raw))
    except json.JSONDecodeError:
        return fallback


# ── Recognition ───────────────────────────────────────────────────────────────

def recognize_image_semantic(
    image_base64: str,
    geometric_primitives: list[dict],
    delta_context: str = "",
) -> dict:
    client = get_client()
    data_url = f"data:image/png;base64,{image_base64}"
    user_text = "Look at the whiteboard image carefully and output the semantic scene JSON.\n\n"
    if delta_context:
        user_text += f"Change hint (secondary context only): {delta_context}\n\n"
    if geometric_primitives:
        geom_summary = json.dumps(geometric_primitives, indent=2)
        user_text += (
            "Supplementary stroke metadata (low-level only — the image is authoritative):\n"
            f"{geom_summary}\n\n"
        )
    user_text += "Trust what you SEE in the image. Output the JSON."

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


def recognize_image(image_base64: str) -> dict:
    return recognize_image_semantic(image_base64, [])


# ── Solve ─────────────────────────────────────────────────────────────────────

def solve_problem(recognition: dict, question: str | None = None) -> dict:
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
    raw = resp.choices[0].message.content or '{"text": "", "steps": null}'
    return _safe_json(raw, {"text": raw[:400], "steps": None})


# ── Live description ──────────────────────────────────────────────────────────

def describe_image(image_base64: str) -> str:
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
        max_tokens=200,
    )
    return (resp.choices[0].message.content or "").strip()
