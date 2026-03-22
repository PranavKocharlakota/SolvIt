"""
Stroke preprocessing + geometry classification pipeline.

Stage A (deterministic):
  preprocess_strokes  → smooth + RDP simplify + normalize
  extract_geometry    → classify each stroke as line_segment / polyline / dot
  fit_curves          → run polynomial fitting on polyline primitives

These run before the LLM so the vision model receives structured geometry,
not just a pixel image.
"""

from __future__ import annotations
import math
from typing import TypedDict


class Point(TypedDict):
    x: float
    y: float
    pressure: float


# ── Basic stroke utilities ────────────────────────────────────────────────────

def _dist_point_to_segment(p: Point, a: Point, b: Point) -> float:
    dx, dy = b["x"] - a["x"], b["y"] - a["y"]
    if dx == 0 and dy == 0:
        return math.hypot(p["x"] - a["x"], p["y"] - a["y"])
    t = ((p["x"] - a["x"]) * dx + (p["y"] - a["y"]) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    return math.hypot(p["x"] - (a["x"] + t * dx), p["y"] - (a["y"] + t * dy))


def rdp_simplify(points: list[Point], epsilon: float = 1.5) -> list[Point]:
    if len(points) < 3:
        return points
    dmax, idx = 0.0, 0
    for i in range(1, len(points) - 1):
        d = _dist_point_to_segment(points[i], points[0], points[-1])
        if d > dmax:
            dmax, idx = d, i
    if dmax >= epsilon:
        left = rdp_simplify(points[:idx + 1], epsilon)
        right = rdp_simplify(points[idx:], epsilon)
        return left[:-1] + right
    return [points[0], points[-1]]


def normalize_strokes(
    strokes: list[dict],
    target_width: float = 100.0,
    target_height: float = 100.0,
) -> list[dict]:
    all_x = [p["x"] for s in strokes for p in s.get("points", [])]
    all_y = [p["y"] for s in strokes for p in s.get("points", [])]
    if not all_x or not all_y:
        return strokes
    min_x, max_x = min(all_x), max(all_x)
    min_y, max_y = min(all_y), max(all_y)
    span_x = max_x - min_x or 1.0
    span_y = max_y - min_y or 1.0
    scale = min(target_width / span_x, target_height / span_y)
    result = []
    for stroke in strokes:
        new_points = [
            {"x": (p["x"] - min_x) * scale, "y": (p["y"] - min_y) * scale, "pressure": p.get("pressure", 0.5)}
            for p in stroke.get("points", [])
        ]
        result.append({**stroke, "points": new_points})
    return result


def smooth_stroke(points: list[Point], window: int = 3) -> list[Point]:
    if len(points) <= window:
        return points
    half = window // 2
    smoothed = []
    for i, p in enumerate(points):
        lo, hi = max(0, i - half), min(len(points), i + half + 1)
        chunk = points[lo:hi]
        smoothed.append({
            "x": sum(c["x"] for c in chunk) / len(chunk),
            "y": sum(c["y"] for c in chunk) / len(chunk),
            "pressure": p.get("pressure", 0.5),
        })
    return smoothed


def preprocess_strokes(strokes: list[dict]) -> list[dict]:
    """Full preprocessing pipeline: smooth → simplify → normalize."""
    processed = []
    for stroke in strokes:
        pts = stroke.get("points", [])
        pts = smooth_stroke(pts)
        pts = rdp_simplify(pts, epsilon=1.5)
        processed.append({**stroke, "points": pts})
    return normalize_strokes(processed)


# ── Stage A: Geometry classification ─────────────────────────────────────────

def classify_stroke(stroke: dict) -> dict | None:
    """
    Convert a single preprocessed stroke into a geometric primitive.

    Rules:
      arc/chord ratio < 1.12 AND <= 8 points  → line_segment
      everything else with >= 2 points         → polyline
      single-point                             → dot (skipped)
    """
    pts = stroke.get("points", [])
    color = stroke.get("color", "#000000")

    if len(pts) < 2:
        return None

    arc_len = sum(
        math.hypot(pts[i]["x"] - pts[i - 1]["x"], pts[i]["y"] - pts[i - 1]["y"])
        for i in range(1, len(pts))
    )
    chord = math.hypot(pts[-1]["x"] - pts[0]["x"], pts[-1]["y"] - pts[0]["y"])
    ratio = arc_len / max(chord, 0.001)

    if ratio < 1.12 and len(pts) <= 8:
        return {
            "type": "line_segment",
            "from": [round(pts[0]["x"], 1), round(pts[0]["y"], 1)],
            "to": [round(pts[-1]["x"], 1), round(pts[-1]["y"], 1)],
            "color": color,
        }

    return {
        "type": "polyline",
        "points": [[round(p["x"], 1), round(p["y"], 1)] for p in pts],
        "color": color,
    }


def extract_geometry(strokes: list[dict]) -> list[dict]:
    """Stage A: Return a list of geometric primitives for all pen strokes."""
    result = []
    for i, stroke in enumerate(strokes):
        if stroke.get("tool", "pen") != "pen":
            continue
        prim = classify_stroke(stroke)
        if prim:
            prim["stroke_id"] = i
            result.append(prim)
    return result


# ── Polynomial fitting ────────────────────────────────────────────────────────

def fit_polynomial_to_points(points: list[list[float]], degree: int = 2) -> dict | None:
    """
    Fit a polynomial of given degree to 2D points (x→y).
    Returns key geometric features if successful.
    """
    try:
        import numpy as np  # optional dependency
    except ImportError:
        return None

    try:
        if len(points) < degree + 2:
            return None
        xs = np.array([p[0] for p in points], dtype=float)
        ys = np.array([p[1] for p in points], dtype=float)
        if float(np.ptp(xs)) < 5.0:   # x range too small — likely a vertical line
            return None

        coeffs = np.polyfit(xs, ys, degree).tolist()
        features: dict = {"degree": degree, "coefficients": [round(c, 4) for c in coeffs]}

        if degree == 2:
            a, b, c = coeffs
            if abs(a) > 1e-6:
                x_v = -b / (2 * a)
                y_v = float(np.polyval(coeffs, x_v))
                features["vertex"] = [round(x_v, 2), round(y_v, 2)]
                features["symmetry_axis_x"] = round(x_v, 2)
                disc = b ** 2 - 4 * a * c
                if disc >= 0:
                    sqrt_d = disc ** 0.5
                    features["x_intercepts"] = sorted([
                        round((-b + sqrt_d) / (2 * a), 2),
                        round((-b - sqrt_d) / (2 * a), 2),
                    ])

        return features
    except Exception:
        return None


def fit_curves_to_primitives(primitives: list[dict]) -> list[dict]:
    """Attempt polynomial fitting on all polyline primitives; attach fit metadata."""
    result = []
    for prim in primitives:
        if prim.get("type") == "polyline":
            fit = fit_polynomial_to_points(prim.get("points", []), degree=2)
            if fit:
                prim = {**prim, "polynomial_fit": fit}
        result.append(prim)
    return result
