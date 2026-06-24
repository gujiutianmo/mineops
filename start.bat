@echo off
chcp 65001 >nul

if /i "%~1" neq "--run-hidden" (
    wscript.exe "%~dp0start-hidden.vbs"
    exit /b
)

setlocal
set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"
set "LOGS=%ROOT%logs"

if not exist "%LOGS%" mkdir "%LOGS%"

echo [%date% %time%] Starting MineOps hidden services... > "%LOGS%\start.log"

python --version >nul 2>&1
if errorlevel 1 (
    echo [%date% %time%] Python is not available in PATH. >> "%LOGS%\start.log"
    exit /b 1
)

netstat -ano | findstr /R /C:":8008 .*LISTENING" >nul 2>&1
if errorlevel 1 (
    echo [%date% %time%] Starting backend on http://127.0.0.1:8008 >> "%LOGS%\start.log"
    powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ^
        "Start-Process -FilePath 'python' -ArgumentList @('-m','uvicorn','main:app','--host','127.0.0.1','--port','8008') -WorkingDirectory '%BACKEND%' -WindowStyle Hidden -RedirectStandardOutput '%LOGS%\backend.out.log' -RedirectStandardError '%LOGS%\backend.err.log'"
) else (
    echo [%date% %time%] Backend port 8008 is already in use; skipped. >> "%LOGS%\start.log"
)

netstat -ano | findstr /R /C:":8088 .*LISTENING" >nul 2>&1
if errorlevel 1 (
    echo [%date% %time%] Starting frontend on http://127.0.0.1:8088 >> "%LOGS%\start.log"
    powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ^
        "Start-Process -FilePath 'python' -ArgumentList @('-m','http.server','8088') -WorkingDirectory '%FRONTEND%' -WindowStyle Hidden -RedirectStandardOutput '%LOGS%\frontend.out.log' -RedirectStandardError '%LOGS%\frontend.err.log'"
) else (
    echo [%date% %time%] Frontend port 8088 is already in use; skipped. >> "%LOGS%\start.log"
)

echo [%date% %time%] MineOps hidden startup commands were sent. >> "%LOGS%\start.log"
endlocal
