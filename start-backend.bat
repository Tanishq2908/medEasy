@echo off
echo ========================================
echo   Doctor AI - Backend Server Launcher
echo ========================================
echo.
echo Starting backend servers...
echo.

REM Start Node.js server in new window
start "Doctor AI - Node.js Server (Port 5002)" cmd /k "cd server && node index.js"

REM Wait a moment for first server to initialize
timeout /t 2 /nobreak >nul

REM Start Python Flask server in new window
start "Doctor AI - Python Flask Server (Port 5000)" cmd /k "python app.py"

echo.
echo ✅ Both servers are starting...
echo.
echo Node.js Server:  http://127.0.0.1:5002
echo Python Flask:    http://127.0.0.1:5000
echo.
echo Check the new command windows for server status.
echo Press any key to run the test suite...
pause >nul

REM Ask if user wants to run tests
echo.
set /p runTests="Run backend integration tests? (Y/N): "
if /i "%runTests%"=="Y" (
    echo.
    echo Running test suite...
    python test_backend.py
    pause
)

echo.
echo To stop servers, close the two command windows.
echo.
