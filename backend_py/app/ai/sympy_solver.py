"""
Symbolic math solver using SymPy.
Attempts to parse and solve equations/expressions from recognized LaTeX or text.
Returns a simplified/solved result as a string, or None if it can't parse.
"""

from __future__ import annotations
import re
from typing import Optional

try:
    import sympy
    from sympy.parsing.latex import parse_latex
    from sympy import sympify, solve, simplify, latex, symbols
    SYMPY_AVAILABLE = True
except ImportError:
    SYMPY_AVAILABLE = False


def _clean_latex(expr: str) -> str:
    """Strip display math delimiters."""
    return re.sub(r"^\$+|^\\\[|\\\]$|\$+$", "", expr.strip()).strip()


def try_solve_latex(latex_str: str) -> Optional[str]:
    """
    Attempt to solve or simplify a LaTeX expression with SymPy.
    Returns a LaTeX string of the result, or None on failure.
    """
    if not SYMPY_AVAILABLE or not latex_str:
        return None
    try:
        cleaned = _clean_latex(latex_str)
        # Try to parse as a sympy expression
        expr = parse_latex(cleaned)
        simplified = simplify(expr)
        return latex(simplified)
    except Exception:
        pass

    # Try sympify on plain text (fallback)
    try:
        text = re.sub(r"\\[a-zA-Z]+", "", latex_str)  # strip LaTeX commands
        expr = sympify(text)
        return latex(simplify(expr))
    except Exception:
        return None


def try_solve_equation(latex_str: str) -> Optional[str]:
    """
    If the expression contains '=', attempt to solve for unknowns.
    Returns solution as a LaTeX string or None.
    """
    if not SYMPY_AVAILABLE or not latex_str:
        return None
    try:
        cleaned = _clean_latex(latex_str)
        if "=" not in cleaned:
            return None

        lhs_str, rhs_str = cleaned.split("=", 1)
        lhs = parse_latex(lhs_str.strip())
        rhs = parse_latex(rhs_str.strip())

        # Collect free symbols
        free = (lhs - rhs).free_symbols
        if not free:
            return None

        target = sorted(free, key=lambda s: str(s))[0]
        solutions = solve(lhs - rhs, target)
        if not solutions:
            return None

        parts = [f"{target} = {latex(s)}" for s in solutions]
        return ", \\ ".join(parts)
    except Exception:
        return None


def augment_steps_with_sympy(steps: list[dict], latex_str: Optional[str]) -> list[dict]:
    """
    For each step that has an equation field, attempt SymPy verification.
    Adds a 'sympy_result' field when successful.
    """
    if not SYMPY_AVAILABLE:
        return steps

    for step in steps:
        eq = step.get("equation") or latex_str
        if not eq:
            continue
        result = try_solve_equation(eq) or try_solve_latex(eq)
        if result:
            step["sympy_result"] = result

    return steps
