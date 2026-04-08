#!/bin/bash

# 切换到脚本所在目录
cd "$(dirname "$0")"

# 进程标识文件
PID_FILE="app.pid"
LOG_FILE="app.log"

# 停止旧进程
stop() {
    if [ -f "$PID_FILE" ]; then
        OLD_PID=$(cat "$PID_FILE")
        if ps -p "$OLD_PID" > /dev/null 2>&1; then
            echo "正在停止旧进程 (PID: $OLD_PID)..."
            kill "$OLD_PID" 2>/dev/null
            sleep 1
            # 如果进程还在，强制杀死
            if ps -p "$OLD_PID" > /dev/null 2>&1; then
                kill -9 "$OLD_PID" 2>/dev/null
            fi
            echo "旧进程已停止"
        else
            echo "旧进程不存在"
        fi
        rm -f "$PID_FILE"
    fi
}

# 启动新进程
start() {
    echo "正在启动服务..."
    nohup venv/bin/python app.py >> "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    sleep 1
    if ps -p $(cat "$PID_FILE") > /dev/null 2>&1; then
        echo "服务已启动 (PID: $(cat "$PID_FILE"))"
    else
        echo "启动失败，请查看 $LOG_FILE"
        exit 1
    fi
}

# 根据参数执行
case "$1" in
    restart)
        stop
        start
        ;;
    stop)
        stop
        ;;
    start|"")
        stop
        start
        ;;
    *)
        echo "用法: $0 {start|stop|restart}"
        exit 1
        ;;
esac