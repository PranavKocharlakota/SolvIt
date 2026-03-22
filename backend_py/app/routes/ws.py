"""
WebSocket endpoint for real-time whiteboard communication.

Message types (client → server):
  { "type": "recognize", "payload": { "imageBase64": "..." } }
  { "type": "solve",     "payload": { "recognition": {...}, "question": "..." } }
  { "type": "draw_step", "payload": { "stepDescription": "..." } }
  { "type": "ping",      "payload": {} }

Message types (server → client):
  { "type": "recognition_result", "payload": {...} }
  { "type": "solve_result",       "payload": {...} }
  { "type": "diagram_result",     "payload": {...} }
  { "type": "error",              "payload": { "message": "..." } }
  { "type": "pong",               "payload": {} }
"""

import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.ai.groq_client import recognize_image, solve_problem, generate_diagram
from app.ai.sympy_solver import augment_steps_with_sympy

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            data = await ws.receive_text()
            try:
                msg = json.loads(data)
            except json.JSONDecodeError:
                await ws.send_json({"type": "error", "payload": {"message": "Invalid JSON"}})
                continue

            msg_type = msg.get("type")
            payload = msg.get("payload", {})

            if msg_type == "ping":
                await ws.send_json({"type": "pong", "payload": {}})

            elif msg_type == "recognize":
                try:
                    raw = payload.get("imageBase64", "").split(",", 1)[-1]
                    result = recognize_image(raw)
                    await ws.send_json({"type": "recognition_result", "payload": result})
                except Exception as e:
                    await ws.send_json({"type": "error", "payload": {"message": str(e)}})

            elif msg_type == "solve":
                try:
                    recognition = payload.get("recognition", {})
                    question = payload.get("question")
                    result = solve_problem(recognition, question)
                    steps = augment_steps_with_sympy(
                        result.get("steps", []),
                        recognition.get("latex")
                    )
                    await ws.send_json({"type": "solve_result", "payload": {"steps": steps}})
                except Exception as e:
                    await ws.send_json({"type": "error", "payload": {"message": str(e)}})

            elif msg_type == "draw_step":
                try:
                    desc = payload.get("stepDescription", "")
                    diagram = generate_diagram(desc)
                    await ws.send_json({"type": "diagram_result", "payload": diagram})
                except Exception as e:
                    await ws.send_json({"type": "error", "payload": {"message": str(e)}})

            else:
                await ws.send_json({"type": "error", "payload": {"message": f"Unknown type: {msg_type}"}})

    except WebSocketDisconnect:
        pass
