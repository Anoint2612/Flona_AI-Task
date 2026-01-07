# AI-Powered B-Roll Insertion System

An intelligent video processing system that automatically analyzes A-roll videos and B-roll clips to generate optimal insertion timelines using semantic understanding and machine learning.

## 🎯 Features

1. **A-Roll Analysis**: Transcribes speech using AssemblyAI STT and extracts temporal context
2. **B-Roll Understanding**: Semantic analysis of B-roll clips using sentence transformers
3. **Intelligent Matching**: Cosine similarity-based matching between transcript and B-roll embeddings
4. **Timeline Generation**: Outputs structured JSON timeline with optimal B-roll insertion points

## 📋 Prerequisites

- Node.js 18+ 
- Python 3.8+
- FFmpeg installed on system
- AssemblyAI API Key

## 🚀 Setup Instructions

### 1. Clone Repository

```bash
git clone <your-repo-url>
cd Flona_AI-Task
```

### 2. Backend Setup

```bash
cd backend
npm install
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

### 4. Python ML Service Setup

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Linux/Mac
# OR
venv\Scripts\activate  # On Windows

# Install Python dependencies
pip install -r python-ml/requirements.txt
```

### 4. Environment Variables

Create a `.env` file in the `backend` directory:

```env
# AssemblyAI API Key (for Speech-to-Text)
STT_API_KEY=your_assemblyai_api_key_here

# Gemini API Key (optional - for future features)
GEMINI_API_KEY=your_gemini_api_key_here

# Python executable path
PYTHON_PATH=python3
```

**How to get API keys:**
- **AssemblyAI**: Sign up at [https://www.assemblyai.com](https://www.assemblyai.com) and get your API key from the dashboard

### 5. Install FFmpeg

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Windows:**
Download from [https://ffmpeg.org/download.html](https://ffmpeg.org/download.html)

## 🏃 Running the Application

### Start Backend Server

```bash
cd backend
node index.js
```

Server will start on `http://localhost:3000`

### Start Frontend (in a new terminal)

```bash
cd frontend
npm run dev
```

Frontend will start on `http://localhost:5173`

### Using the Application

1. Open `http://localhost:5173` in your browser
2. Enter descriptions for A-roll and B-roll clips
3. Click "Generate Plan"
4. View the transcript, insertion plan, and explanations

### Test via API (Alternative)

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d @video_url.json
```

## 📊 Output Artifacts

After successful ingestion, the system generates the following files in `backend/storage/{asset_id}/`:

### 1. `manifest.json`
Complete metadata about the ingested assets including technical specifications.

```json
{
  "asset_id": "uuid",
  "created_at": "2026-01-07T...",
  "a_roll": {
    "url": "...",
    "metadata": "Description of A-roll content",
    "technical_metadata": {
      "duration": 40.12,
      "resolution": "704x1280",
      "fps": 25
    }
  },
  "b_rolls": [...]
}
```

### 2. `transcript.json`
Sentence-level transcription with timestamps.

```json
[
  {
    "id": 0,
    "start": 1.28,
    "end": 13.52,
    "text": "Transcribed text here..."
  }
]
```

### 3. `vector_store.json`
Semantic embeddings (384-dimensional vectors) for transcript segments and B-rolls.

```json
{
  "transcriptSegments": [
    {
      "id": 0,
      "start": 1.28,
      "end": 13.52,
      "text": "...",
      "embedding": [0.023, -0.145, ...]
    }
  ],
  "brolls": [
    {
      "id": "broll_1",
      "metadata": "Description",
      "embedding": [0.019, -0.132, ...]
    }
  ]
}
```

### 4. `plan.json` ⭐ **PRIMARY OUTPUT**
**Structured timeline plan for B-roll insertions.**

```json
[
  {
    "start_sec": 13.84,
    "duration_sec": 3,
    "broll_id": "broll_3",
    "similarity_score": 0.5032,
    "matched_segment": "1_chunk_0"
  },
  {
    "start_sec": 20.5,
    "duration_sec": 3,
    "broll_id": "broll_2",
    "similarity_score": 0.4876,
    "matched_segment": "2_chunk_1"
  }
]
```

**Field Descriptions:**
- `start_sec`: When to insert the B-roll (timestamp in seconds)
- `duration_sec`: How long to show the B-roll (always 3 seconds)
- `broll_id`: Which B-roll clip to use
- `similarity_score`: Semantic similarity score (0-1, higher = better match)
- `matched_segment`: Which transcript segment/chunk was matched

## 📁 Project Structure

```
Flona_AI-Task/
├── backend/
│   ├── src/
│   │   ├── controllers/      # API endpoint handlers
│   │   ├── services/          # Business logic
│   │   │   ├── ingest.service.js       # Main ingestion pipeline
│   │   │   ├── stt.service.js          # Speech-to-text (AssemblyAI)
│   │   │   ├── embedding.service.js    # Python ML integration
│   │   │   ├── matching.service.js     # B-roll matching algorithm
│   │   │   └── render.service.js       # Video rendering (optional)
│   │   ├── utils/             # Helper functions
│   │   ├── routes/            # API routes
│   │   └── app.js             # Express app setup
│   ├── storage/               # Generated outputs (gitignored)
│   ├── index.js               # Server entry point
│   ├── package.json
│   └── .env                   # Environment variables
├── python-ml/
│   ├── embed.py               # Embedding generation service
│   └── requirements.txt       # Python dependencies
├── venv/                      # Python virtual environment (gitignored)
└── video_url.json             # Example input payload
```

## 🔧 API Endpoints

### Health Check
```
GET /api/health
```
Returns: `{ "status": "ok" }`

### Video Ingestion
```
POST /api/ingest
Content-Type: application/json

{
  "a_roll": {
    "url": "https://...",
    "metadata": "Description of A-roll content"
  },
  "b_rolls": [
    {
      "id": "broll_1",
      "url": "https://...",
      "metadata": "Description of B-roll"
    }
  ]
}
```

Returns: `{ "asset_id": "uuid", "status": "completed" }`

## 🧪 Example Input (video_url.json)

```json
{
  "a_roll": {
    "url": "https://example.com/a_roll.mp4",
    "metadata": "Young woman discussing food safety"
  },
  "b_rolls": [
    {
      "id": "broll_1",
      "url": "https://example.com/broll_1.mp4",
      "metadata": "Street food stall context shot"
    },
    {
      "id": "broll_2",
      "url": "https://example.com/broll_2.mp4",
      "metadata": "Food containers on table"
    }
  ]
}
```

## 🧠 How It Works

1. **Video Download**: Downloads A-roll and B-roll videos from remote URLs
2. **Metadata Extraction**: Uses FFmpeg to extract duration, resolution, FPS
3. **Transcription**: Extracts audio and transcribes using AssemblyAI
4. **Embedding Generation**: 
   - Runs Python ML service with `sentence-transformers`
   - Generates 384-dim embeddings for transcript sentences and B-roll descriptions
5. **Segment Splitting**: Long transcript segments (>10s) split into ~6s chunks
6. **Similarity Matching**: Computes cosine similarity between transcript and B-roll embeddings
7. **Constraint Application**:
   - Max 5 insertions
   - 3-second B-roll duration
   - Minimum 3-second gap between insertions
   - Avoid first/last 5 seconds of video
8. **Plan Generation**: Outputs structured timeline JSON

## 🔍 Matching Algorithm

- Uses **all-MiniLM-L6-v2** model for semantic embeddings
- Cosine similarity (dot product of normalized vectors)
- Greedy selection: highest similarity scores first
- Temporal constraints prevent overlaps and maintain flow

## 🛠️ Dependencies

### Backend (Node.js)
- `express` - Web framework
- `assemblyai` - Speech-to-text API
- `axios` - HTTP client
- `fluent-ffmpeg` - Video processing
- `ffmpeg-static`, `ffprobe-static` - FFmpeg binaries
- `uuid` - Unique ID generation
- `cors` - CORS middleware
- `dotenv` - Environment variables

### Python ML
- `sentence-transformers` - Embedding generation
- `numpy` - Numerical operations
- `torch` - PyTorch (CPU version)

## 📝 Notes

- Video rendering functionality is disabled by default (focus on analysis and planning)
- To enable rendering, uncomment `await renderVideo(assetDir)` in `ingest.service.js`
- First run downloads ML model (~90MB) - subsequent runs are faster

## 🐛 Troubleshooting

**Server won't start:**
- Check if port 3000 is already in use: `lsof -i :3000`
- Kill existing process: `pkill -f "node index.js"`

**Python embedding fails:**
- Verify virtual environment is created: `ls venv/`
- Check Python dependencies: `pip list`
- Ensure `embed.py` exists: `ls python-ml/embed.py`

**FFmpeg errors:**
- Verify installation: `ffmpeg -version`
- Install if missing (see setup instructions above)

**AssemblyAI errors:**
- Verify API key in `.env`
- Check API quota at [https://www.assemblyai.com](https://www.assemblyai.com)

## 📄 License

This project is licensed under the MIT License.

## 👥 Contributors

Built with ❤️ using Node.js, Python, and AI/ML technologies.
