#!/bin/bash
# macOS 双击启动：Finder 里双击这个文件即可（首次需要在“右键 -> 打开”一次以绕过安全限制）。
cd "$(dirname "$0")" || exit 1
node scripts/start.mjs
echo ""
read -n 1 -s -r -p "按任意键关闭窗口…"
