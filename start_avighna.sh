#!/bin/bash

echo "🚀 Starting Avighna HR Platform Setup..."

# Step 1: Install Backend Dependencies
echo "📦 Installing backend drivers..."
cd backend
../venv/bin/pip install -r requirements.txt

# Step 2: Start Backend in background
echo "🔌 Starting Backend Server (FastAPI)..."
../venv/bin/python main.py &
BACKEND_PID=$!

# Step 3: Start Frontend
echo "🎨 Starting Frontend Server (Vite)..."
cd ../frontend
npm install
npm run dev

# Cleanup background processes on exit
trap "kill $BACKEND_PID" EXIT
