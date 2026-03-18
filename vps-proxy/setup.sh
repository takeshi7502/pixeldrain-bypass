#!/bin/bash
# ============================================================
# Pixeldrain Proxy - Auto Setup Script cho VPS Ubuntu mới
# Cách dùng: curl -s https://raw.githubusercontent.com/takeshi7502/pixeldrain-bypass/master/vps-proxy/setup.sh | bash
# ============================================================

set -e  # Dừng ngay nếu có lỗi

PROXY_PORT=3456
APP_DIR="/root/pixeldrain-proxy"
REPO_URL="https://github.com/takeshi7502/pixeldrain-bypass.git"
APP_NAME="pixeldrain-proxy"

echo "============================================"
echo "  Pixeldrain VPS Proxy - Auto Installer"
echo "============================================"

# ---- 1. Cập nhật hệ thống ----
echo "[1/6] Cập nhật hệ thống..."
apt-get update -qq

# ---- 2. Cài Node.js 20 LTS ----
echo "[2/6] Cài đặt Node.js 20 LTS..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
else
  echo "  ✓ Node.js đã có: $(node -v)"
fi

# ---- 3. Cài PM2 ----
echo "[3/6] Cài đặt PM2..."
npm install -g pm2 -qq
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

# ---- 4. Clone hoặc cập nhật code từ GitHub ----
echo "[4/6] Lấy code Proxy từ GitHub..."
if [ -d "$APP_DIR" ]; then
  echo "  Thư mục đã có, cập nhật code..."
  git -C "$APP_DIR" pull
else
  git clone "$REPO_URL" "$APP_DIR"
fi

# ---- 5. Cài dependencies ----
echo "[5/6] Cài đặt thư viện Node.js..."
cd "$APP_DIR/vps-proxy"
npm install --omit=dev -qq

# ---- 6. Chạy bằng PM2 ----
echo "[6/6] Khởi động proxy..."
# Xoá app cũ nếu có
pm2 delete "$APP_NAME" 2>/dev/null || true

cd "$APP_DIR/vps-proxy"
PORT=$PROXY_PORT pm2 start server.js --name "$APP_NAME"
pm2 save

# ---- Mở firewall ----
echo "Mở cổng $PROXY_PORT..."
ufw allow $PROXY_PORT/tcp 2>/dev/null || true
iptables -A INPUT -p tcp --dport $PROXY_PORT -j ACCEPT 2>/dev/null || true

# ---- Lấy và hiển thị IP của VPS ----
PUBLIC_IP=$(curl -s https://api.ipify.org || curl -s https://checkip.amazonaws.com || echo "Không lấy được IP")

echo ""
echo "============================================"
echo "  ✅ Cài đặt THÀNH CÔNG!"
echo "============================================"
echo ""
echo "  🌐 Proxy URL:"
echo "     http://$PUBLIC_IP:$PROXY_PORT/download/{fileId}"
echo ""
echo "  🏥 Health Check:"
echo "     curl http://$PUBLIC_IP:$PROXY_PORT/ping"
echo ""
echo "  📋 Xem log:"
echo "     pm2 logs $APP_NAME"
echo ""
echo "  📌 QUAN TRỌNG: Copy địa chỉ này vào mảng VPS_PROXY_LIST"
echo "     trong file direct_link_generator.py của con Bot Mirror!"
echo "     \"http://$PUBLIC_IP:$PROXY_PORT\""
echo "============================================"
