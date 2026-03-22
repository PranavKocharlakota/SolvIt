from fastapi import APIRouter, HTTPException
from app.models.schemas import RecognizeRequest, RecognitionResult
from app.ai.groq_client import recognize_image_semantic, describe_image
from app.ai.stroke_processor import preprocess_strokes, extract_geometry

router = APIRouter()


@router.post("/recognize", response_model=RecognitionResult)
async def recognize(req: RecognizeRequest):
    try:
        raw_b64 = req.imageBase64.split(",", 1)[-1]

        # Stage A: build a compact stroke summary to give the model context
        stroke_summary: list[dict] = []
        if req.strokes:
            preprocessed = preprocess_strokes([s.model_dump() for s in req.strokes])
            stroke_summary = extract_geometry(preprocessed)

        # Build delta hint
        delta_context = ""
        if req.delta and req.delta.newStrokeCount > 0:
            d = req.delta
            delta_context = f"{d.newStrokeCount} new stroke(s) added since last analysis"
            if d.changedRegion:
                r = d.changedRegion
                delta_context += (
                    f" in region x=[{r.normMinX:.0f},{r.normMaxX:.0f}]"
                    f" y=[{r.normMinY:.0f},{r.normMaxY:.0f}]"
                )
            delta_context += ". Focus on this changed area."
        elif req.delta and req.delta.removedStrokeCount > 0:
            delta_context = f"{req.delta.removedStrokeCount} stroke(s) erased."

        # Stage B: vision model semantic analysis
        result = recognize_image_semantic(raw_b64, stroke_summary, delta_context)

        # Fallback: if semantic recognition failed, use live description
        if result["description"] == "Unable to recognize.":
            fallback_desc = describe_image(raw_b64)
            if fallback_desc and fallback_desc != "Unable to recognize.":
                result["description"] = fallback_desc

        return RecognitionResult(**result)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
