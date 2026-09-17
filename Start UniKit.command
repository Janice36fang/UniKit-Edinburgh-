#!/bin/zsh

set -u

UNIKIT_DIR=${0:A:h}
UNIKIT_URL="http://127.0.0.1:4173/?v=1.7.0#profile"

cd "$UNIKIT_DIR" || exit 1

if /usr/bin/curl --silent --fail "http://127.0.0.1:4173/api/health" >/dev/null 2>&1; then
  /usr/bin/open "$UNIKIT_URL"
  exit 0
fi

UNIKIT_NODE=""
if command -v node >/dev/null 2>&1; then
  UNIKIT_NODE=$(command -v node)
elif [[ -x /opt/homebrew/bin/node ]]; then
  UNIKIT_NODE=/opt/homebrew/bin/node
elif [[ -x /usr/local/bin/node ]]; then
  UNIKIT_NODE=/usr/local/bin/node
fi

if [[ -z "$UNIKIT_NODE" ]]; then
  /usr/bin/osascript -e 'display dialog "未找到 Node.js 20 或更高版本。请先安装 Node.js，再重新双击启动。" buttons {"知道了"} default button 1 with title "UniKit 无法启动"'
  exit 1
fi

"$UNIKIT_NODE" server.mjs &
UNIKIT_SERVER_PID=$!
trap 'kill "$UNIKIT_SERVER_PID" >/dev/null 2>&1 || true' EXIT INT TERM

for UNIKIT_TRY in {1..30}; do
  if /usr/bin/curl --silent --fail "http://127.0.0.1:4173/api/health" >/dev/null 2>&1; then
    /usr/bin/open "$UNIKIT_URL"
    break
  fi
  /bin/sleep 0.2
done

echo "UniKit 已启动：$UNIKIT_URL"
echo "保持此窗口打开；关闭窗口会停止网页服务。"
wait "$UNIKIT_SERVER_PID"
