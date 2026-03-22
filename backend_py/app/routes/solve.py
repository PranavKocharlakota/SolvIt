from fastapi import APIRouter, HTTPException
from app.models.schemas import SolveRequest, SolveResponse, SolutionStep
from app.ai.groq_client import solve_problem
from app.ai.sympy_solver import augment_steps_with_sympy

router = APIRouter()


@router.post("/solve", response_model=SolveResponse)
async def solve(req: SolveRequest):
    try:
        recognition_dict = req.recognition.model_dump(by_alias=True)
        result = solve_problem(recognition_dict, req.question)
        steps = result.get("steps", [])

        # Augment steps with SymPy symbolic verification
        steps = augment_steps_with_sympy(steps, req.recognition.latex)

        return SolveResponse(steps=[SolutionStep(**s) for s in steps])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
