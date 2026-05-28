#!/data/data/com.termux/files/usr/bin/bash
# ============================================================
#   ANDROBOT INSTALLER FOR TERMUX
#   Repo: https://github.com/celode/androbot
#   Auto-fix: jimp version conflict & other dependency issues
# ============================================================

# ── Warna ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()   { echo -e "${YELLOW}[!]${NC} $1"; }
error()  { echo -e "${RED}[✗]${NC} $1"; }
info()   { echo -e "${CYAN}[i]${NC} $1"; }
header() { echo -e "\n${BOLD}${CYAN}══════════════════════════════════════${NC}"; \
           echo -e "${BOLD}${CYAN}  $1${NC}"; \
           echo -e "${BOLD}${CYAN}══════════════════════════════════════${NC}\n"; }

# ── Utilitas ───────────────────────────────────────────────
check_cmd() {
    command -v "$1" &>/dev/null
}

run_or_die() {
    if ! eval "$1"; then
        error "Gagal menjalankan: $1"
        exit 1
    fi
}

# ── Cek Termux ─────────────────────────────────────────────
header "ANDROBOT TERMUX INSTALLER"
info "Memverifikasi environment Termux..."

if [ ! -d "/data/data/com.termux" ]; then
    warn "Direktori Termux tidak terdeteksi, melanjutkan dengan asumsi lingkungan yang kompatibel."
fi

# ── Step 1: Update & Upgrade ───────────────────────────────
header "Step 1: Update Repository"
info "Memperbarui paket Termux..."
yes | pkg update -y 2>/dev/null || warn "Update sebagian gagal, melanjutkan..."
yes | pkg upgrade -y 2>/dev/null || warn "Upgrade sebagian gagal, melanjutkan..."
log "Repository diperbarui."

# ── Step 2: Install Dependensi Sistem ─────────────────────
header "Step 2: Install Dependensi Sistem"

PKGS=(git nodejs-lts ffmpeg python libpng libjpeg-turbo libwebp)

for pkg in "${PKGS[@]}"; do
    if check_cmd "$pkg" || dpkg -l "$pkg" &>/dev/null 2>&1; then
        log "$pkg sudah terinstall."
    else
        info "Menginstall $pkg..."
        if ! yes | pkg install "$pkg" -y 2>/dev/null; then
            warn "Gagal install $pkg via pkg, mencoba cara lain..."
        else
            log "$pkg berhasil diinstall."
        fi
    fi
done

# Verifikasi Node.js versi (butuh >= 20)
if check_cmd node; then
    NODE_VER=$(node -e "console.log(process.version)" 2>/dev/null | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VER" -lt 20 ] 2>/dev/null; then
        warn "Node.js versi $NODE_VER terdeteksi. Androbot membutuhkan v20+."
        info "Mencoba install nodejs versi lebih baru..."
        yes | pkg install nodejs -y 2>/dev/null || warn "Tidak bisa upgrade Node.js otomatis."
        NODE_VER=$(node -e "console.log(process.version)" 2>/dev/null | sed 's/v//' | cut -d. -f1)
        if [ "$NODE_VER" -lt 20 ] 2>/dev/null; then
            error "Node.js v20+ diperlukan. Install manual: pkg install nodejs-lts"
            error "Atau coba: pkg install nodejs"
            read -p "Lanjutkan meski Node.js < 20? (y/N): " CONT
            [[ "$CONT" =~ ^[Yy]$ ]] || exit 1
        fi
    else
        log "Node.js v$NODE_VER ✓"
    fi
else
    error "Node.js tidak ditemukan setelah instalasi. Cek koneksi internet."
    exit 1
fi

# ── Step 3: Install Yarn & PM2 ────────────────────────────
header "Step 3: Install Yarn & PM2"

if check_cmd yarn; then
    log "Yarn sudah terinstall: $(yarn --version)"
else
    info "Menginstall Yarn..."
    npm install -g yarn 2>/dev/null
    if check_cmd yarn; then
        log "Yarn berhasil diinstall."
    else
        warn "Yarn gagal via npm, mencoba via pkg..."
        yes | pkg install yarn -y 2>/dev/null
    fi
fi

if check_cmd pm2; then
    log "PM2 sudah terinstall: $(pm2 --version)"
else
    info "Menginstall PM2..."
    npm install -g pm2 2>/dev/null
    if check_cmd pm2; then
        log "PM2 berhasil diinstall."
    else
        warn "PM2 gagal diinstall. Bot bisa dijalankan manual dengan: node index.js"
    fi
fi

# ── Step 4: Clone Repository ──────────────────────────────
header "Step 4: Clone Androbot"

INSTALL_DIR="$HOME/androbot"

if [ -d "$INSTALL_DIR" ]; then
    warn "Direktori $INSTALL_DIR sudah ada."
    read -p "Hapus dan install ulang? (y/N): " REINSTALL
    if [[ "$REINSTALL" =~ ^[Yy]$ ]]; then
        rm -rf "$INSTALL_DIR"
        log "Direktori lama dihapus."
    else
        info "Menggunakan direktori yang ada, melanjutkan ke install dependensi..."
    fi
fi

if [ ! -d "$INSTALL_DIR" ]; then
    info "Meng-clone repo androbot..."
    if ! git clone https://github.com/celode/androbot "$INSTALL_DIR"; then
        error "Clone gagal. Periksa koneksi internet."
        exit 1
    fi
    log "Repository berhasil di-clone ke $INSTALL_DIR"
fi

cd "$INSTALL_DIR" || exit 1

# ── Step 5: Fix package.json - Jimp & Dependensi ─────────
header "Step 5: Fix Dependensi (jimp & lainnya)"

info "Mem-patch package.json untuk Termux compatibility..."

# Backup package.json asli
cp package.json package.json.bak
log "Backup package.json -> package.json.bak"

# Patch jimp ke versi yang kompatibel (0.22.x adalah versi stabil jimp terbaru yg bukan ESM)
# jimp 0.16.x bisa punya issue di Termux dengan native modules
# Juga patch sqlite3 yang sering error di Termux

node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Fix jimp - 0.16.0 bisa error di Termux, gunakan 0.22.12 (terakhir CJS)
if (pkg.dependencies && pkg.dependencies.jimp) {
    const oldJimp = pkg.dependencies.jimp;
    pkg.dependencies.jimp = '0.22.12';
    console.log('  jimp: ' + oldJimp + ' → 0.22.12');
}

// Fix sqlite3 - gunakan versi yang sudah ada prebuilt binary
if (pkg.dependencies && pkg.dependencies.sqlite3) {
    const oldSqlite = pkg.dependencies.sqlite3;
    pkg.dependencies.sqlite3 = '^5.1.6';
    console.log('  sqlite3: ' + oldSqlite + ' → ^5.1.6');
}

// Hapus pm2 dari dependencies (sudah install global)
if (pkg.dependencies && pkg.dependencies.pm2) {
    delete pkg.dependencies.pm2;
    console.log('  pm2: dihapus dari dependencies (sudah global)');
}

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
console.log('package.json berhasil di-patch!');
" 2>/dev/null

if [ $? -eq 0 ]; then
    log "package.json berhasil di-patch."
else
    warn "Patch otomatis gagal. Melanjutkan dengan package.json original..."
    cp package.json.bak package.json
fi

# ── Step 6: Install Dependencies ─────────────────────────
header "Step 6: Install Node Dependencies"

# Hapus node_modules & lock file lama jika ada
if [ -d "node_modules" ]; then
    warn "node_modules lama ditemukan, menghapus..."
    rm -rf node_modules
fi

# Coba install dengan yarn dulu
info "Mencoba install dengan yarn..."

# Set environment variables untuk bantu build native modules di Termux
export PYTHON=$(which python3 2>/dev/null || which python 2>/dev/null)
export npm_config_build_from_source=true

if yarn install --ignore-scripts 2>/dev/null; then
    log "Dependensi berhasil diinstall dengan yarn (--ignore-scripts)."
    
    # Build script yang aman saja (bukan semua)
    info "Mencoba build sqlite3..."
    yarn rebuild sqlite3 2>/dev/null || warn "sqlite3 rebuild gagal, mencoba alternatif..."
    
else
    warn "yarn install gagal, mencoba npm..."
    if npm install --ignore-scripts 2>/dev/null; then
        log "Dependensi berhasil diinstall dengan npm."
        npm rebuild sqlite3 2>/dev/null || warn "sqlite3 rebuild via npm gagal."
    else
        error "npm install juga gagal. Mencoba install satu per satu..."
        # Install tanpa sqlite3 dulu, lalu coba lagi
        node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const sqlite = pkg.dependencies.sqlite3;
delete pkg.dependencies.sqlite3;
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
fs.writeFileSync('.sqlite3_version', sqlite || '^5.1.6');
"
        yarn install --ignore-scripts 2>/dev/null || npm install --ignore-scripts 2>/dev/null
        
        # Coba install sqlite3 dengan better-sqlite3 sebagai fallback
        SQLITE_VER=$(cat .sqlite3_version 2>/dev/null || echo "^5.1.6")
        info "Mencoba install sqlite3 $SQLITE_VER..."
        yarn add "sqlite3@$SQLITE_VER" --ignore-scripts 2>/dev/null || \
        npm install "sqlite3@$SQLITE_VER" --ignore-scripts 2>/dev/null || \
        warn "sqlite3 gagal diinstall. Bot mungkin tidak bisa menggunakan database lokal."
    fi
fi

# ── Step 7: Fix jimp Post-Install ────────────────────────
header "Step 7: Verifikasi & Fix jimp"

info "Mengetes jimp..."
if node -e "const jimp = require('jimp'); console.log('jimp OK, versi:', jimp.version || 'unknown');" 2>/dev/null; then
    log "jimp berfungsi normal."
else
    warn "jimp bermasalah. Mencoba reinstall jimp dengan versi yang berbeda..."
    
    for JIMP_VER in "0.22.12" "0.21.3" "0.16.13" "0.16.2"; do
        info "Mencoba jimp@$JIMP_VER ..."
        yarn add "jimp@$JIMP_VER" --ignore-scripts 2>/dev/null || \
        npm install "jimp@$JIMP_VER" --ignore-scripts 2>/dev/null
        
        if node -e "require('jimp')" 2>/dev/null; then
            log "jimp@$JIMP_VER berhasil!"
            break
        fi
        warn "jimp@$JIMP_VER masih bermasalah, mencoba versi lain..."
    done
    
    # Cek final
    if ! node -e "require('jimp')" 2>/dev/null; then
        warn "jimp tidak bisa diinstall dengan benar."
        warn "Fitur yang menggunakan jimp (sticker, image edit) mungkin tidak berfungsi."
        warn "Bot tetap bisa berjalan untuk fitur lainnya."
    fi
fi

# ── Step 8: Konfigurasi .env ──────────────────────────────
header "Step 8: Konfigurasi Bot"

if [ -f ".env" ]; then
    warn ".env sudah ada. Lewati konfigurasi otomatis."
    info "Edit manual: nano $INSTALL_DIR/.env"
else
    info "Membuat file .env dari template..."
    
    echo ""
    echo -e "${BOLD}Masukkan konfigurasi bot:${NC}"
    echo -e "${YELLOW}(Tekan Enter untuk skip / isi nanti di .env)${NC}"
    echo ""
    
    read -p "  Session String (RGNK~xxxxx): " SESSION_STR
    read -p "  Nama Bot [AndroBot]: " BOT_NAME_VAL
    read -p "  Nomor SUDO (contoh: 6281234567890): " SUDO_VAL
    read -p "  Prefix Handler [.,!]: " HANDLER_VAL
    read -p "  Timezone [Asia/Jakarta]: " TZ_VAL
    read -p "  Database URL (kosong = pakai SQLite lokal): " DB_URL

    BOT_NAME_VAL="${BOT_NAME_VAL:-AndroBot}"
    HANDLER_VAL="${HANDLER_VAL:-.,!}"
    TZ_VAL="${TZ_VAL:-Asia/Jakarta}"

    cat > .env << EOF
# ── Bot Configuration ──────────────────────────────
BOT_NAME=${BOT_NAME_VAL}
HANDLERS=${HANDLER_VAL}
SUDO=${SUDO_VAL}

# ── Session ────────────────────────────────────────
# Single session:   SESSION=RGNK~xxxxx
# Multi session:    SESSION=RGNK~xxxxx,RGNK~yyyyy
SESSION=${SESSION_STR}

# ── Database ───────────────────────────────────────
# Untuk cloud (Render, Railway): isi DATABASE_URL
# Untuk lokal Termux: kosongkan (SQLite otomatis)
DATABASE_URL=${DB_URL}

# ── Localization ───────────────────────────────────
LANGUAGE=id
TZ=${TZ_VAL}
EOF

    log ".env berhasil dibuat."
    info "Edit kapan saja: nano $INSTALL_DIR/.env"
fi

# ── Step 9: Buat Script Start/Stop ───────────────────────
header "Step 9: Membuat Script Shortcut"

# start.sh
cat > "$INSTALL_DIR/start.sh" << 'STARTSCRIPT'
#!/data/data/com.termux/files/usr/bin/bash
cd "$(dirname "$0")"
echo "[AndroBot] Memulai bot..."

if command -v pm2 &>/dev/null; then
    pm2 start index.js --name androbot --attach
else
    echo "[AndroBot] PM2 tidak ditemukan, menjalankan langsung..."
    node index.js
fi
STARTSCRIPT
chmod +x "$INSTALL_DIR/start.sh"

# stop.sh
cat > "$INSTALL_DIR/stop.sh" << 'STOPSCRIPT'
#!/data/data/com.termux/files/usr/bin/bash
echo "[AndroBot] Menghentikan bot..."
if command -v pm2 &>/dev/null; then
    pm2 stop androbot
    pm2 delete androbot
else
    pkill -f "node index.js" && echo "Bot dihentikan." || echo "Bot tidak sedang berjalan."
fi
STOPSCRIPT
chmod +x "$INSTALL_DIR/stop.sh"

# restart.sh
cat > "$INSTALL_DIR/restart.sh" << 'RESTARTSCRIPT'
#!/data/data/com.termux/files/usr/bin/bash
echo "[AndroBot] Me-restart bot..."
if command -v pm2 &>/dev/null; then
    pm2 restart androbot
else
    pkill -f "node index.js"
    sleep 1
    cd "$(dirname "$0")"
    node index.js &
    echo "Bot di-restart (background)."
fi
RESTARTSCRIPT
chmod +x "$INSTALL_DIR/restart.sh"

log "Script start.sh / stop.sh / restart.sh dibuat."

# ── Step 10: Verifikasi Final ─────────────────────────────
header "Step 10: Verifikasi Instalasi"

ERRORS=0

# Cek modul kritis
MODULES=("baileys" "axios" "dotenv" "sequelize")
for mod in "${MODULES[@]}"; do
    if node -e "require('$mod')" 2>/dev/null; then
        log "Module $mod ✓"
    else
        warn "Module $mod tidak bisa di-load"
        ((ERRORS++))
    fi
done

# Cek jimp
if node -e "require('jimp')" 2>/dev/null; then
    log "Module jimp ✓"
else
    warn "Module jimp ✗ (fitur image mungkin terbatas)"
fi

# Cek .env
if [ -f ".env" ] && grep -q "SESSION=" .env; then
    SESSION_CHECK=$(grep "^SESSION=" .env | cut -d= -f2)
    if [ -n "$SESSION_CHECK" ]; then
        log ".env dengan session ✓"
    else
        warn ".env ada tapi SESSION kosong — isi sebelum menjalankan bot!"
    fi
else
    warn ".env tidak ditemukan atau SESSION belum diisi!"
fi

# ── Ringkasan ─────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}══════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  INSTALASI SELESAI!${NC}"
echo -e "${BOLD}${GREEN}══════════════════════════════════════${NC}"
echo ""
echo -e "  ${CYAN}Direktori:${NC}  $INSTALL_DIR"
echo -e "  ${CYAN}Node.js:${NC}    $(node --version 2>/dev/null)"
echo -e "  ${CYAN}Yarn:${NC}       $(yarn --version 2>/dev/null || echo 'tidak tersedia')"
echo -e "  ${CYAN}PM2:${NC}        $(pm2 --version 2>/dev/null || echo 'tidak tersedia')"
echo ""
echo -e "${BOLD}Cara menjalankan bot:${NC}"
echo -e "  ${YELLOW}cd ~/androbot && bash start.sh${NC}"
echo ""
echo -e "${BOLD}Edit konfigurasi:${NC}"
echo -e "  ${YELLOW}nano ~/androbot/.env${NC}"
echo ""

if [ $ERRORS -gt 0 ]; then
    warn "$ERRORS modul kritis bermasalah. Jalankan ulang installer jika bot error."
fi

if ! grep -q "^SESSION=RGNK" "$INSTALL_DIR/.env" 2>/dev/null; then
    echo -e "${RED}⚠ PENTING:${NC} Isi SESSION di .env sebelum menjalankan bot!"
    echo -e "  Dapatkan session di: ${CYAN}https://raganork.site${NC}"
    echo ""
fi

echo -e "${CYAN}Telegram support: https://t.me/raganork_in${NC}"
echo ""
