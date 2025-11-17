#!/bin/bash

# Kill any existing Flask processes
pkill -f "python.*app.py" 2>/dev/null || true

# Kill any existing React processes  
pkill -f "npm.*start" 2>/dev/null || true
pkill -f "react-scripts" 2>/dev/null || true

echo "🔥 Starting K8s Smart Bot Development Servers..."
echo "📍 Backend: http://localhost:5000"
echo "📍 Frontend: http://localhost:3000"
echo "🔗 Topology: http://localhost:3000/topology"
echo ""

# Start Flask backend
echo "🐍 Starting Flask backend..."
cd /home/z/my-project
python app.py &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start React frontend
echo "⚛️ Starting React frontend..."
cd /home/z/my-project/main-app
npm start &
FRONTEND_PID=$!

echo ""
echo "✅ Both servers started!"
echo "📊 Health Check: http://localhost:5000/health"
echo "🎯 Topology: http://localhost:3000/topology"
echo ""
echo "Press Ctrl+C to stop both servers"

# Function to kill both processes on exit
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    echo "✅ All servers stopped"
    exit 0
}

# Set up trap for Ctrl+C
trap cleanup INT

# Wait for processes
wait