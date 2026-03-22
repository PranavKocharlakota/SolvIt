# Solvit - Math Whiteboard AI

A full-stack web application that recognizes handwritten mathematical expressions and provides AI-powered solutions with step-by-step explanations.

## Overview

Solvit combines a modern React frontend with an interactive whiteboard (using Konva.js) and a FastAPI backend powered by the Groq AI API. Users can draw mathematical expressions on a canvas, and the system recognizes them, solves them, and explains the solution in real-time.

## Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool
- **Konva.js** - Interactive canvas rendering
- **KaTeX** - Mathematical formula rendering
- **React Konva** - React bindings for Konva

### Backend
- **FastAPI** - Modern Python web framework
- **Python 3.8+** - Programming language
- **Groq API** - AI model for recognition and solving
- **SymPy** - Symbolic mathematics
- **Pillow** - Image processing
- **WebSockets** - Real-time communication

## Project Structure

```
HackHayward/
├── frontend/                      # React frontend application
│   ├── src/
│   │   ├── solvit/               # Main Solvit component
│   │   │   ├── Solvit.tsx        # Main app component
│   │   │   ├── SolvitCanvas.tsx  # Canvas with Konva
│   │   │   ├── types.ts          # TypeScript types
│   │   │   ├── constants.tsx     # App constants
│   │   │   ├── components.tsx    # UI components
│   │   │   ├── useBoard.ts       # Canvas hook
│   │   │   └── Solvit.css        # Styling
│   │   ├── components/           # Reusable components
│   │   ├── hooks/                # Custom React hooks
│   │   ├── lib/                  # Utilities and API client
│   │   └── main.tsx              # Entry point
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── backend_py/                    # FastAPI backend
│   ├── app/
│   │   ├── main.py               # FastAPI application
│   │   ├── run.py                # Entry point with Uvicorn
│   │   ├── routes/               # API endpoints
│   │   │   ├── recognize.py      # Recognition endpoint
│   │   │   ├── solve.py          # Solve endpoint
│   │   │   ├── describe.py       # Description endpoint
│   │   │   └── ws.py             # WebSocket handler
│   │   ├── models/               # Pydantic schemas
│   │   │   └── schemas.py        # Request/response models
│   │   └── ai/                   # AI modules
│   │       ├── groq_client.py    # Groq API client
│   │       ├── stroke_processor.py # Stroke processing
│   │       ├── sympy_solver.py   # Math solving
│   │       └── raster_enhance.py # Image enhancement
│   ├── .env                       # Environment variables
│   ├── .venv/                     # Virtual environment
│   └── requirements.txt
│
└── solvit_frontend/               # Backup source files
```

## Quick Start

### Prerequisites
- Node.js 16+ (for frontend)
- Python 3.8+ (for backend)
- Groq API key (get it at https://console.groq.com)

### Installation

#### Backend Setup
```bash
cd backend_py

# Activate virtual environment
source .venv/Scripts/activate  # bash/git bash
# or
.\.venv\Scripts\activate       # PowerShell

# Verify environment file
cat .env  # Should have GROQ_API_KEY and PORT=3002
```

#### Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Verify installation
npm run build  # Should compile without errors
```

### Running the Application

#### Terminal 1: Start Backend
```bash
cd backend_py
source .venv/Scripts/activate
python run.py
```
Backend runs on `http://localhost:3002`

#### Terminal 2: Start Frontend
```bash
cd frontend
npm run dev
```
Frontend opens on `http://localhost:5173`

## API Endpoints

### REST API

#### Recognize Drawing
```http
POST /api/recognize
Content-Type: application/json

{
  "imageBase64": "data:image/png;base64,...",
  "strokes": [...],
  "delta": {...}
}
```

**Response:**
```json
{
  "description": "Quadratic equation",
  "latex": "x^2 + 2x + 1 = 0",
  "content_type": "equation",
  "elements": [...]
}
```

#### Solve Problem
```http
POST /api/solve
Content-Type: application/json

{
  "recognition": {...},
  "question": "Solve for x"
}
```

**Response:**
```json
{
  "text": "The solution is...",
  "steps": [
    {
      "stepNumber": 1,
      "explanation": "First, we...",
      "equation": "..."
    }
  ]
}
```

#### Describe Diagram
```http
POST /api/describe
Content-Type: application/json

{
  "imageBase64": "data:image/png;base64,..."
}
```

**Response:**
```json
{
  "description": "A right triangle with..."
}
```

### WebSocket
```
WS /ws
```

**Client → Server:**
```json
{
  "type": "recognize",
  "payload": {"imageBase64": "..."}
}
```

**Server → Client:**
```json
{
  "type": "recognition_result",
  "payload": {...}
}
```

## Features

### Canvas Interaction
- **Drawing Tools:** Pen, arrow, eraser, text, select
- **Canvas Modes:** Chalkboard, grid, paper
- **Customization:** Brush size, colors, opacity, highlighters
- **Real-time Recognition:** Instant feedback as you draw

### Math Recognition
- Recognizes handwritten math expressions
- Converts to LaTeX format
- Identifies mathematical symbols and operators
- Extracts geometry from strokes

### Problem Solving
- Solves algebraic equations
- Provides step-by-step solutions
- Uses SymPy for symbolic mathematics
- AI-powered explanations via Groq

### Real-time Communication
- WebSocket support for instant updates
- Live problem solving feedback
- Collaborative whiteboard features

## Development

### Build Frontend
```bash
cd frontend
npm run build
```

Creates optimized production build in `dist/` folder.

### Preview Production Build
```bash
cd frontend
npm run preview
```

### Development Server with Hot Reload
```bash
cd frontend
npm run dev
```

### Type Checking
```bash
cd frontend
npx tsc --noEmit
```

## Configuration

### Backend Environment (`.env`)
```env
GROQ_API_KEY=your_api_key_here
PORT=3002
```

### Frontend Configuration (`vite.config.ts`)
- Dev server: `localhost:5173`
- API proxy: `http://localhost:3002/api`

## Troubleshooting

### Port Already in Use
```bash
# macOS/Linux
lsof -i :5173
kill -9 <PID>

# Windows
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

### Module Not Found (Frontend)
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### GROQ API Errors
- Verify API key in `backend_py/.env`
- Check API quota at https://console.groq.com
- Ensure internet connection is working

### TypeScript Errors
```bash
cd frontend
npm run build  # Check for compilation errors
npx tsc --noEmit
```

## Recent Fixes

### Fixed Issues
1. **KaTeX CSS Import** - Missing dependency installed
2. **Konva Module Resolution** - Fresh npm install resolved issues
3. **Frontend File Naming** - All source files renamed to match imports

### Current Status
- ✅ Frontend builds successfully
- ✅ Backend imports work correctly
- ✅ All API endpoints functional
- ✅ Ready for development

## Performance Tips

- Enable production build: `npm run build`
- Use WebSocket for real-time features (faster than REST)
- Clear browser cache if styles don't update
- Monitor Groq API usage for rate limits

## Security

- API key stored in `.env` (not in version control)
- CORS enabled for localhost development
- Validate all user inputs on backend
- Use environment variables for sensitive data

## Future Enhancements

- [ ] User authentication and session management
- [ ] Save/load drawings from database
- [ ] Share whiteboards with others
- [ ] Advanced math problem types
- [ ] Mobile app version
- [ ] Offline mode

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is part of HackHayward.

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review API documentation
3. Check browser console for errors
4. Verify backend is running on port 3002

---

**Last Updated:** March 2025
**Status:** Production Ready ✅
