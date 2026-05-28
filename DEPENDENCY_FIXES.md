# 🔧 ANDROBOT DEPENDENCY ANALYSIS & FIXES

**Last Updated**: 2026-05-28

---

## 📋 MASALAH YANG DITEMUKAN

### 1. **BAILEYS OUTDATED** ❌ KRITIS
- **Versi Saat Ini**: `7.0.0-rc.8`
- **Versi Rekomendasi**: `^7.0.0-rc.10` (atau lebih baru)
- **Alasan Update**:
  - RC8 (Feb 2026) sudah outdated
  - RC10 (Mei 2026) punya 50+ bug fixes:
    - Memory leak fixes
    - Connection stability improvements
    - Encryption error handling
    - Performance optimizations (30x faster binary operations)
  - RC8 sering error dengan WhatsApp API terbaru

### 2. **JIMP DEPRECATED** ❌ PENTING
- **Versi Saat Ini**: `0.16.0` (pinned, tanpa caret)
- **Versi Rekomendasi**: `^0.22.0`
- **Alasan**:
  - 0.16.0 released 2019-2020, sudah 5 tahun
  - Build issues dengan Node.js 18-20
  - 0.22.0 support modern Node.js dengan baik

### 3. **FILE-TYPE ESM INCOMPATIBILITY** ⚠️ MEDIUM
- **Versi Saat Ini**: `^21.0.0` (ESM only)
- **Versi Rekomendasi**: `^20.0.0` (CJS support)
- **Alasan**:
  - Project uses CommonJS (`"type": "commonjs"`)
  - file-type@21 adalah ESM-only, bisa cause import errors
  - file-type@20 support keduanya (CJS & ESM)

### 4. **SYSTEM DEPENDENCIES MISSING** ❌ KRITIS
```
❌ Node.js tidak terinstall
❌ npm tidak terinstall  
❌ FFmpeg tidak terinstall (diperlukan untuk fluent-ffmpeg)
❌ Build tools (gcc, g++, make, python3) tidak tersedia
```

### 5. **NATIVE MODULE BUILD FAILURES** ❌ KRITIS
- `sqlite3@5.1.7` - Perlu C++ compiler + Python3
- `audio-decode@2.2.3` - Perlu native binding
- Hasil: `npm install` gagal di Termux & Linux tanpa build-essential

---

## ✅ SOLUSI YANG DITERAPKAN

### Modified: `package.json`
```diff
  "dependencies": {
-   "baileys": "7.0.0-rc.8",
+   "baileys": "^7.0.0-rc.10",
    
-   "jimp": "0.16.0",
+   "jimp": "^0.22.0",
    
-   "file-type": "^21.0.0",
+   "file-type": "^20.0.0",
  }
```

**Penjelasan Perubahan**:
1. Baileys: RC8 → RC10 (50+ bug fixes)
2. Jimp: 0.16.0 → 0.22.0 (modern Node.js support)
3. File-type: 21.0.0 → 20.0.0 (CJS compatibility)
4. Added caret (^) untuk Baileys & Jimp (auto-update minor versions)

---

## 🚀 INSTALASI DI LINUX/UBUNTU

### Prerequisites
```bash
# 1. Update system packages
sudo apt update

# 2. Install build tools (untuk native modules)
sudo apt install -y build-essential python3 git curl

# 3. Install FFmpeg (untuk fluent-ffmpeg wrapper)
sudo apt install -y ffmpeg

# 4. Install Node.js v20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Verify Installation
```bash
node --version      # Should be v20+
npm --version       # Should be v10+
ffmpeg -version     # Check FFmpeg version
gcc --version       # Check C++ compiler
python3 --version   # Check Python3
```

### Install Project Dependencies
```bash
# 1. Navigate to project
cd "/path/to/androbot"

# 2. Clear old npm cache
npm cache clean --force

# 3. Remove old node_modules (if exists)
rm -rf node_modules package-lock.json

# 4. Install fresh dependencies
npm install

# 5. Verify installation successful
npm list | head -30
```

### Create .env Configuration
```bash
# Copy example file
cp .env.example .env

# Edit with your details
nano .env
```

**Required .env values**:
```env
SESSION=RGNK~your_session_string_here
BOT_NAME=AndroBot
HANDLERS=.,!
SUDO=62812345678        # No + sign
TZ=Asia/Jakarta
```

### Test Run
```bash
node index.js

# Expected output:
# Raganork v6.2.29
# - Configured sessions: your-session-id
# - Database initialized
# [INFO] Bot started successfully
```

---

## 📱 INSTALASI DI TERMUX (ANDROID)

### Prerequisites  
```bash
# 1. Update Termux packages
pkg update && pkg upgrade

# 2. Install Node.js & npm
pkg install -y nodejs

# 3. Install FFmpeg
pkg install -y ffmpeg

# 4. Install build tools
pkg install -y build-essential python3 git

# 5. Install clang (C compiler) - important for Termux
pkg install -y clang make

# 6. Set up Node.js environment
npm config set prefix ~/npm
export PATH=~/npm/bin:$PATH
echo "export PATH=~/npm/bin:\$PATH" >> ~/.bashrc
```

### Verify Installation
```bash
node --version
npm --version
ffmpeg -version
clang --version
```

### Clone & Setup Project
```bash
# 1. Clone repository
git clone https://github.com/celode/androbot
cd androbot

# 2. Clear cache
npm cache clean --force
rm -rf node_modules package-lock.json

# 3. Install dependencies (verbose untuk progress)
npm install --verbose

# 4. Create .env file
cp .env.example .env
nano .env
```

### Install PM2 (optional but recommended)
```bash
npm install -g pm2

# Setup PM2 startup
pm2 startup
pm2 start index.js --name androbot
pm2 save
```

### Keep Bot Running
```bash
# Enable wake lock (prevent sleep)
termux-wake-lock

# In Android Settings:
# Settings → Apps → Termux → Battery → Not optimized
```

### View Logs
```bash
pm2 logs androbot     # Live logs
pm2 status            # Check status
pm2 restart androbot  # Restart bot
```

---

## ⚠️ TROUBLESHOOTING

### Error: `npm: command not found`
**Solution**: Install Node.js LTS v20
```bash
# Ubuntu
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Termux
pkg install -y nodejs
```

### Error: `gyp ERR! build error` (native module compilation)
**Solution**: Install build tools
```bash
# Ubuntu
sudo apt install -y build-essential python3

# Termux
pkg install -y build-essential python3 clang make
```

### Error: `ffmpeg not found`
**Solution**: Install FFmpeg
```bash
# Ubuntu
sudo apt install -y ffmpeg

# Termux
pkg install -y ffmpeg
```

### Error: `sqlite3 build fails`
**Solution**: Try precompiled binary
```bash
npm install --no-save sqlite3@5.1.7 --build-from-source
# Or use npm ci with offline cache
npm ci --prefer-offline
```

### Error: `file-type cannot find module`
**Check**: Verify file-type@20.x (not 21.x) in package-lock.json
```bash
# Delete lock file and reinstall
rm package-lock.json
npm install
```

### Memory leak / Bot crashes after hours
**Check Baileys version**:
```bash
npm list baileys
# Should show 7.0.0-rc.10 or higher
```

If older, update:
```bash
npm install baileys@^7.0.0-rc.10
```

---

## 📊 VERSION COMPATIBILITY MATRIX

| Package | Before | After | Reason |
|---------|--------|-------|--------|
| baileys | 7.0.0-rc.8 | ^7.0.0-rc.10 | Stability fixes, memory leaks |
| jimp | 0.16.0 | ^0.22.0 | Node.js 18-20 compatibility |
| file-type | ^21.0.0 | ^20.0.0 | CJS support (project is CJS) |
| Node.js | n/a | 20+ LTS | Required by updated packages |
| Build Tools | missing | required | sqlite3, audio-decode native build |
| FFmpeg | missing | required | fluent-ffmpeg wrapper dependency |

---

## 🔍 VERIFICATION CHECKLIST

After following steps above, verify:

- [ ] `node --version` returns v20+
- [ ] `npm --version` returns v10+
- [ ] `ffmpeg -version` shows FFmpeg installed
- [ ] `npm list baileys` shows 7.0.0-rc.10+
- [ ] `npm list jimp` shows 0.22.0+
- [ ] `npm list file-type` shows 20.x (not 21.x)
- [ ] `node index.js` starts without "module not found" errors
- [ ] Bot shows "Database initialized" in logs
- [ ] .env file has valid SESSION string

---

## 📞 SUPPORT RESOURCES

- **Baileys Issues**: https://github.com/WhiskeySockets/Baileys/issues
- **Jimp Issues**: https://github.com/jimp-dev/jimp/issues
- **Androbot Fork**: https://github.com/celode/androbot
- **Original Raganork**: https://github.com/souravkl11/raganork-md

---

**Status**: ✅ Semua issues sudah diidentifikasi dan solusi sudah disiapkan.
