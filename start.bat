@echo off
chcp 65001 >nul
echo 正在启动矿山管理系统...
echo.

REM 检查 Python 是否可用
python --version >nul 2>&1
if errorlevel 1 (
    echo 错误：未安装 Python 或未添加到环境变量 PATH 中。
    pause
    exit /b 1
)

REM 启动后端服务器
echo 正在启动后端服务器（端口 8008）...
cd backend
start "矿山管理系统 - 后端" python -m uvicorn main:app --host 0.0.0.0 --port 8008
cd ..

REM 启动前端 HTTP 服务器
echo 正在启动前端服务器（端口 8000）...
cd frontend
start "矿山管理系统 - 前端" python -m http.server 8000
cd ..

REM 等待服务器启动
timeout /t 5 /nobreak > nul

echo.
echo 服务器启动成功！
echo.
echo 后端地址：http://localhost:8008
echo 前端地址：http://localhost:8000
echo.
echo 请使用浏览器打开 http://localhost:8000 访问系统。
echo.
echo 按任意键关闭此窗口（服务器将继续运行）...
pause > nul
