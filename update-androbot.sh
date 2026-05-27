cat > ~/androbot/update-androbot.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}[i]${NC} Mengecek update dari GitHub..."

cd ~/androbot

BEFORE=$(git rev-parse HEAD)

git pull origin main

AFTER=$(git rev-parse HEAD)

if [ "$BEFORE" = "$AFTER" ]; then
  echo -e "${YELLOW}[!]${NC} Tidak ada update. Bot sudah versi terbaru."
else
  echo -e "${GREEN}[✓]${NC} Ada update! Menginstall dependencies baru..."
  yarn install
  echo -e "${GREEN}[✓]${NC} Restart bot..."
  pm2 restart androbot
  echo -e "${GREEN}[✓]${NC} Bot berhasil diupdate & direstart!"
fi
EOF

chmod +x ~/androbot/update-androbot.sh
