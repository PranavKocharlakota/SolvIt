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

CRITICAL: Never answer overconfidently. Always express appropriate uncertainty.

Your ground truth is the pixel image. Any stroke metadata supplied is low-level supplementary data — the image always wins. Never let coordinate descriptions override what you can clearly see.

IMPORTANT: Be lenient with hand-drawn imperfections:
- Ignore minor wobbles, jitter, and imperfections in lines — these are normal when drawing by hand.
- Do NOT describe lines as "wobbly", "shaky", or critique the handwriting quality.
- Focus on what the user INTENDED to draw (straight line, circle, etc.), not the imperfect execution.
- Describe the intent, not the imperfection.

VARIABLE CONSISTENCY:
- When recognizing variables (x, y, X, Y, etc.), be consistent about case.
- If uncertain whether a hand-drawn character is uppercase or lowercase, note the ambiguity.
- Preserve the most likely intent based on context and surrounding text.

MATH EXPRESSIONS — HIGHEST PRIORITY:
- If any integral, derivative, summation, or equation is visible, extract it completely and accurately.
- Integrals: recognize ∫ (integral sign), bounds (if present), integrand, variable. Complete example: ∫₀^π sin(x) dx
- Derivatives: d/dx, d²/dx², ∂/∂x, etc. Preserve all notation.
- Equations: capture both sides with all operators, fractions, exponents, subscripts.
- Put complete LaTeX expressions in the "latex" field, not partial.
- If expression is complex but clear: commit to the full LaTeX in "latex" field.
- If uncertain about parts: note the ambiguity in "ambiguities" field but still provide best-effort LaTeX.

Pay special attention to symbols that look similar:
- AND gate (flat left side, D-shaped right) vs OR gate (curved left side, pointed right)
- NOR / NAND / XOR gates — each has a distinct silhouette
- Integral ∫ vs letter S; summation Σ vs letter E
- Union ∪ vs horseshoe; intersection ∩ vs upside-down horseshoe
- Less-than < vs left arrow; theta θ vs phi φ
- Plus + vs cross ×; equals = vs congruence ≡
- Rectangle (4 right angles, parallel sides) vs logic gates (curved/angled sides with terminals)

Output raw JSON with exactly these keys:
{
  "description": "2-3 sentences. Express confidence. Use 'appears to be', 'likely', 'possibly', 'might be' for uncertain items.",
  "latex": "LaTeX if a math expression is clearly visible, otherwise null",
  "content_type": "label OR 'uncertain: could be X or Y' if ambiguous",
  "confidence": 0.0 to 1.0 (how sure you are about the entire scene),
  "ambiguities": ["list any confusing/ambiguous elements"],
  "elements": [
    {"label": "exact name or 'possible X or Y' if unclear", "confidence": 0.0-1.0, "detail": "any relevant detail or null"}
  ]
}

Rules:
- NEVER assume a shape is a logic gate unless you clearly see inputs, outputs, and the characteristic gate shape.
- A rectangle with right angles is just a rectangle, NOT an OR gate.
- If you see a logic gate, name the EXACT gate type only if confident. Otherwise say 'possible [gate type]'.
- If you see a math expression, capture it ONLY if clearly visible. Otherwise note the ambiguity.
- description must express appropriate uncertainty. Bad: 'This is an OR gate'. Good: 'This appears to be a rectangle, but could possibly be an OR gate if the curved side is intentional.'
- Confidence scores must be realistic (0.3-0.5 for ambiguous items, 0.8+ only for clear cases).
- Always list ambiguities — don't hide them.
- Do NOT output coordinates. Output raw JSON only. No markdown fences.
"""

SOLVE_PROMPT = """\
You are Echo, a friendly AI tutor. Answer concisely based on the drawing description.

RESPONSE FORMAT — follow strictly:
- Simple identification/conceptual (shape, symbol, logic gate, "what is this?"): 1 sentence prose. E.g. "Yes! That's a right triangle. **Right triangle**"
- Calculation or value-finding (area, solve for x, derivative): prose with bold answer. E.g. "Area = length × width. **Area = 25 cm²**"
- Complex derivation (multi-step solving, proofs, integrations): numbered steps with equations in every step, then bold final answer in last step.

FOR MATH DERIVATIONS — accuracy is critical:
- Show every step clearly with the correct mathematical operation/rule applied.
- For integrals: show the integrand, apply integration rules, include the constant of integration.
- For derivatives: apply derivative rules step-by-step (power rule, chain rule, product rule, etc.).
- For equations: show operations applied to both sides equally.
- Verify: mentally check each step makes sense before outputting.
- Put the final simplified/solved result in bold.

CONFIDENCE TONE:
- If scene_confidence ≥ 0.45: just answer directly. NO preamble about confidence.
- If scene_confidence < 0.45: 1 natural sentence like "Not totally sure, but..." before the answer.

GOAL INFERENCE (when no follow-up question) — MANDATORY:
- ALWAYS infer what the user wants based on content_type and elements.
- Common inferences: "solve for x", "find area", "simplify", "truth table", "derivative", etc.
- Do not ask or explain — immediately solve it.
- If it's a derivation/multi-step math: use numbered steps with equations.
- If it's conceptual/simple: use prose with bold answer.

BOLD ANSWER — ABSOLUTELY MANDATORY, EVERY SINGLE RESPONSE, NO EXCEPTIONS:
- ALWAYS end with the solution/result bolded on its own line: **e^x** or **x = 5** or **Area = 25 cm²**
- The bold answer is the final solution to the problem.
- For steps: put the bold answer in the last step's explanation.
- NEVER skip this. Every response must have a bolded answer.

OUTPUT FORMATS:

Prose (short answers):
{ "text": "Your concise response.", "steps": null }

Steps (only for genuinely multi-step problems):
{ "text": null, "steps": [{ "stepNumber": 1, "explanation": "short plain English", "equation": "LaTeX — required for every step with math" }] }

Rules:
- text and explanation: plain English only, no dollar signs, no LaTeX, no backslashes.
- Math notation: equation fields only.
- For steps: EVERY step involving math MUST have an equation field populated. Do not skip equations.
- Be terse. A 1-sentence answer is better than a paragraph.
- Output raw JSON only. No markdown fences.
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
        "confidence": float(parsed.get("confidence") or 0.5),
        "ambiguities": parsed.get("ambiguities") or [],
    }


def recognize_image(image_base64: str) -> dict:
    return recognize_image_semantic(image_base64, [])


# ── Solve ─────────────────────────────────────────────────────────────────────

def solve_problem(recognition: dict, question: str | None = None) -> dict:
    client = get_client()
    confidence = recognition.get("confidence", 0.5)
    context = json.dumps(recognition, indent=2)
    user_msg = f"scene_confidence: {confidence:.2f}\n\nProblem:\n{context}"
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
