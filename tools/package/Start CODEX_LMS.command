#!/bin/bash
# Double-click me. Pick how you want to open CODEX_LMS.
cd "$(dirname "$0")" || exit 1
xattr -dr com.apple.quarantine . 2>/dev/null   # downloaded files are blocked until this is cleared
HAVE_APP=0; [ -d "CODEX_LMS.app" ] && HAVE_APP=1
HAVE_NODE=0; command -v node >/dev/null 2>&1 && HAVE_NODE=1
while true; do
  clear
  echo
  echo "   CODEX_LMS"
  echo "   A hands-on course for your Mac terminal"
  echo
  echo "   How do you want to open it?"
  echo
  [ $HAVE_APP = 1 ] && echo "     1)  Mac app          native window, sidebar and search"
  echo "     2)  Web browser      works anywhere, Python exercises included"
  if [ $HAVE_NODE = 1 ]; then echo "     3)  Terminal         full-screen text version, mouse works"
  else echo "     3)  Terminal         (needs Node: brew install node)"; fi
  echo "     q)  Quit"
  echo
  read -r -p "   Choose: " c
  case "$c" in
    1) if [ $HAVE_APP = 1 ]; then open CODEX_LMS.app; echo; echo "   Opened. You can close this window."; sleep 1; exit 0; fi ;;
    2) open CODEX_LMS.html; echo; echo "   Opened in your browser. You can close this window."; sleep 1; exit 0 ;;
    3) if [ $HAVE_NODE = 1 ]; then exec node CODEX_LMS.html --tui; else echo; echo "   Install Node first:  brew install node   (or https://nodejs.org)"; read -r -p "   Press return"; fi ;;
    q|Q) exit 0 ;;
  esac
done
