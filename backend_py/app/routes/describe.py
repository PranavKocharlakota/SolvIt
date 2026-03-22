from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.ai.groq_client import describe_image

router = APIRouter()


class DescribeRequest(BaseModel):
    imageBase64: str


@router.post("/describe")
async def describe(req: DescribeRequest):
    try:
        raw = req.imageBase64.split(",", 1)[-1]
        text = describe_image(raw)
        return {"description": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
