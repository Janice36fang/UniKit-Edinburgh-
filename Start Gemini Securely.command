#!/bin/zsh

set -u

UNIKIT_DIR=${0:A:h}
cd "$UNIKIT_DIR" || exit 1
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH"

if /usr/bin/curl -fsS "http://127.0.0.1:4173/api/health" 2>/dev/null | /usr/bin/grep -q '"contractAnalysis":"configured"'; then
  echo "UniKit Gemini 版已经在运行，正在打开网页……"
  /usr/bin/open "http://127.0.0.1:4173/?v=1.7.0&provider=gemini#profile"
  exit 0
fi

UNIKIT_GEMINI_KEY=$(/usr/bin/osascript -e 'text returned of (display dialog "请粘贴刚刚创建的 Gemini API Key。\n\n密钥只用于本次 UniKit 服务，不会写入聊天或项目文件。" default answer "" with hidden answer buttons {"取消", "启动 Gemini"} default button "启动 Gemini" with title "UniKit 安全配置")' 2>/dev/null)

if [[ -z "$UNIKIT_GEMINI_KEY" ]]; then
  echo "没有收到密钥或操作已取消。"
  exit 1
fi

export GEMINI_API_KEY="$UNIKIT_GEMINI_KEY"
export AI_DEFAULT_SOURCE=gemini
unset UNIKIT_GEMINI_KEY

echo "已安全接收密钥，正在启动 UniKit Gemini 版……"
UNIKIT_LOG_PATH="/tmp/unikit-gemini-start.log"
nohup npm start > "$UNIKIT_LOG_PATH" 2>&1 &
UNIKIT_SERVER_PID=$!

for attempt in {1..15}; do
  if /usr/bin/curl -fsS "http://127.0.0.1:4173/api/health" >/dev/null 2>&1; then
    echo "UniKit 已启动：http://127.0.0.1:4173/?v=1.7.0&provider=gemini#profile"
    /usr/bin/open "http://127.0.0.1:4173/?v=1.7.0&provider=gemini#profile"
    /usr/bin/osascript -e 'display notification "Gemini 合同识别已连接" with title "UniKit 已启动"' >/dev/null 2>&1
    exit 0
  fi
  /bin/sleep 1
done

/bin/kill "$UNIKIT_SERVER_PID" >/dev/null 2>&1 || true
echo "UniKit 启动失败。诊断记录：$UNIKIT_LOG_PATH"
/usr/bin/osascript -e 'display dialog "UniKit 服务没有成功启动。请回到 Codex 告诉我，我会继续检查。" buttons {"好"} default button "好" with icon caution with title "UniKit 启动失败"' >/dev/null 2>&1
exit 1
