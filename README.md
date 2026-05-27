# 🤖 Androbot — Termux Self-Hosting Guide

Deploy dan kelola [androbot](https://github.com/celode/androbot) (fork dari raganork-md) langsung di Android menggunakan Termux — tanpa VPS, tanpa chroot.

---

## 📋 Prasyarat

Sebelum mulai, pastikan kamu sudah:

- Menginstall **Termux** (dari F-Droid, bukan Play Store)
- Mendapatkan **Session String** dari [https://raganork.site](https://raganork.site)
- Memberikan izin storage ke Termux: `termux-setup-storage`

---

## 🚀 Instalasi

### 1. Jalankan Script Installer

Copy dan jalankan perintah berikut di Termux:

```bash
curl -sL https://raw.githubusercontent.com/celode/androbot/main/deploy-androbot.sh -o deploy-androbot.sh
bash deploy-androbot.sh
```

Atau jika kamu sudah punya file-nya secara lokal:

```bash
bash deploy-androbot.sh
```

Script ini akan otomatis:

- Update & install semua dependency (`git`, `nodejs-lts`, `ffmpeg`, `yarn`, `pm2`)
- Clone repo androbot ke `~/androbot`
- Menanyakan Session String, nama bot, nomor SUDO, dan timezone
- Membuat file `.env` secara otomatis
- Menjalankan bot via PM2

---

## 🔄 Update Bot

Jika repo GitHub androbot ada perubahan, jalankan script updater:

```bash
bash ~/androbot/update-androbot.sh
```

Script ini akan:

- Mengecek apakah ada commit baru dari GitHub
- Jika **ada update**: otomatis `yarn install` dan restart bot via PM2
- Jika **tidak ada update**: memberitahu bahwa bot sudah versi terbaru — tanpa restart

---

## 🛠️ Perintah PM2 Berguna

```bash
pm2 logs androbot       # Lihat log bot secara live
pm2 restart androbot    # Restart bot
pm2 stop androbot       # Stop bot
pm2 status              # Cek status semua proses
```

---

## ⚠️ Tips Agar Bot Tidak Mati

Android agresif dalam mematikan proses background. Lakukan ini setelah install:

**1. Aktifkan wake lock di Termux:**
```bash
termux-wake-lock
```

**2. Nonaktifkan battery optimization** untuk aplikasi Termux:
Pengaturan → Aplikasi → Termux → Baterai → Tidak Dioptimalkan

**3. Autostart PM2 saat Termux dibuka ulang:**
```bash
pm2 startup
# ikuti instruksi yang muncul di terminal
pm2 save
```

---

## 📁 Struktur File

```
~/androbot/
├── plugins/              # Plugin bot
├── core/                 # Library inti
├── .env                  # Konfigurasi (SESSION, BOT_NAME, dll)
├── index.js              # Entry point
├── config.js             # Handler konfigurasi
├── deploy-androbot.sh    # Script installer
└── update-androbot.sh    # Script updater
```

---

## 🔧 Konfigurasi `.env`

| Variable | Keterangan | Contoh |
|---|---|---|
| `SESSION` | Session string dari raganork.site | `RGNK~xxxxx` |
| `BOT_NAME` | Nama bot yang tampil | `AndroBot` |
| `HANDLERS` | Prefix perintah | `.,!` |
| `SUDO` | Nomor HP admin (tanpa +) | `628123456789` |
| `TZ` | Timezone | `Asia/Jakarta` |
| `DATABASE_URL` | PostgreSQL URL (opsional, untuk cloud) | `postgresql://...` |

---

## ⚖️ Legal Notice

> ⚠️ Gunakan dengan risiko sendiri. Bot ini menggunakan metode tidak resmi WhatsApp Web API dan dapat menyebabkan pemblokiran akun sementara maupun permanen. Proyek ini tidak terafiliasi dengan WhatsApp Inc. Hanya untuk tujuan edukasi dan riset.

---

## 🔗 Links

- Repo asli: [souravkl11/raganork-md](https://github.com/souravkl11/raganork-md)
- Fork ini: [celode/androbot](https://github.com/celode/androbot)
- Komunitas: [Telegram @raganork_in](https://t.me/raganork_in)
- Session Generator: [raganork.site](https://raganork.site)
