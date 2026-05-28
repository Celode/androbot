#!/data/data/com.termux/files/usr/bin/bash
# ============================================
#   ANDROBOT - Auto Deploy Script for Termux
#   https://github.com/celode/androbot
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error(){ echo -e "${RED}[✗]${NC} $1"; exit 1; }
info() { echo -e "${CYAN}[i]${NC} $1"; }

echo -e "${CYAN}"
echo "╔══════════════════════════════════════╗"
echo "║     ANDROBOT - Termux Installer      ║"
echo "╚══════════════════════════════════════╝"
echo -e "${NC}"

# ── 1. Update & Install dependencies ──────────────────────
info "Update package list..."
pkg update -y && pkg upgrade -y

info "Install dependencies..."
pkg install -y git nodejs-lts ffmpeg python make clang

log "Dependencies installed."

# ── 2. Install global npm packages ────────────────────────
info "Installing pm2..."
npm install -g pm2
log "pm2 installed."

# ── 3. Force HTTPS (hindari error SSH git) ────────────────
info "Mengatur git agar pakai HTTPS..."
git config --global url."https://github.com/".insteadOf "ssh://git@github.com/"
git config --global url."https://github.com/".insteadOf "git@github.com:"
log "Git HTTPS override aktif."

# ── 4. Clone repo ─────────────────────────────────────────
INSTALL_DIR="$HOME/androbot"

if [ -d "$INSTALL_DIR" ]; then
  warn "Folder $INSTALL_DIR sudah ada. Skip clone, lanjut install deps..."
else
  info "Cloning repo..."
  git clone https://github.com/celode/androbot "$INSTALL_DIR"
  log "Clone selesai."
fi

cd "$INSTALL_DIR"

# ── 5. Bersihkan lock file lama (jika ada) ─────────────────
info "Membersihkan lock file lama..."
rm -f yarn.lock package-lock.json
rm -rf node_modules

# ── 6. Install project dependencies ───────────────────────
info "Install project dependencies..."
npm install --legacy-peer-deps
log "Dependencies project terinstall."

# ── 7. Konfigurasi .env ───────────────────────────────────
if [ ! -f ".env" ]; then
  info "Membuat file .env..."

  echo ""
  warn "Kamu perlu SESSION STRING dari https://raganork.site"
  echo -n "Masukkan SESSION STRING kamu: "
  read SESSION_STRING

  echo -n "Masukkan nama bot (default: AndroBot): "
  read BOT_NAME
  BOT_NAME=${BOT_NAME:-AndroBot}

  echo -n "Masukkan nomor SUDO (format: 628xxx, tanpa +): "
  read SUDO_NUM

  echo -n "Masukkan timezone (default: Asia/Jakarta): "
  read TZ_VAL
  TZ_VAL=${TZ_VAL:-Asia/Jakarta}

  cat > .env <<EOF
# Bot Configuration
SESSION=$SESSION_STRING
BOT_NAME=$BOT_NAME
HANDLERS=.,!
SUDO=$SUDO_NUM

# Localization
LANGUAGE=en
TZ=$TZ_VAL
EOF

  log ".env berhasil dibuat."
else
  warn ".env sudah ada, skip konfigurasi."
fi

# ── 8. Jalankan bot dengan PM2 ─────────────────────────────
info "Menjalankan bot dengan PM2..."
pm2 start index.js --name androbot
pm2 save

log "Bot berjalan!"

# ── 9. Info tambahan ───────────────────────────────────────
echo ""
echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║          PERINTAH BERGUNA            ║${NC}"
echo -e "${CYAN}╠══════════════════════════════════════╣${NC}"
echo -e "║  ${GREEN}pm2 logs androbot${NC}    → lihat log    ║"
echo -e "║  ${GREEN}pm2 restart androbot${NC} → restart bot  ║"
echo -e "║  ${GREEN}pm2 stop androbot${NC}    → stop bot     ║"
echo -e "║  ${GREEN}pm2 status${NC}           → cek status   ║"
echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
echo ""
warn "Aktifkan wake lock agar bot tidak mati saat layar mati:"
info "Jalankan: termux-wake-lock"
