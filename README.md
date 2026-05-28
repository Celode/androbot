<div align="center">

```
░█████╗░███╗░░██╗██████╗░██████╗░░█████╗░██████╗░░█████╗░████████╗
██╔══██╗████╗░██║██╔══██╗██╔══██╗██╔══██╗██╔══██╗██╔══██╗╚══██╔══╝
███████║██╔██╗██║██║░░██║██████╔╝██║░░██║██████╦╝██║░░██║░░░██║░░░
██╔══██║██║╚████║██║░░██║██╔══██╗██║░░██║██╔══██╗██║░░██║░░░██║░░░
██║░░██║██║░╚███║██████╔╝██║░░██║╚█████╔╝██████╦╝╚█████╔╝░░░██║░░░
╚═╝░░╚═╝╚═╝░░╚══╝╚═════╝░╚═╝░░╚═╝░╚════╝░╚═════╝░░╚════╝░░░╚═╝░░░
```

**WhatsApp Bot · Ringan · Cepat · Jalan di HP Android**

[![Node](https://img.shields.io/badge/Node.js-v20+-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/Platform-Termux%20%7C%20VPS%20%7C%20Docker-25A162?style=flat-square&logo=android&logoColor=white)](https://termux.dev)
[![License](https://img.shields.io/badge/License-GPL--3.0-blue?style=flat-square)](LICENSE)
[![Powered by](https://img.shields.io/badge/Powered%20by-Baileys-blueviolet?style=flat-square)](https://github.com/WhiskeySockets/Baileys)
[![Fork of](https://img.shields.io/badge/Fork%20of-raganork--md-orange?style=flat-square)](https://github.com/souravkl11/raganork-md)

</div>

---

## ✦ Apa itu Androbot?

**Androbot** adalah WhatsApp bot framework ringan berbasis [Baileys](https://github.com/WhiskeySockets/Baileys), hasil fork dari [raganork-md](https://github.com/souravkl11/raganork-md) — dioptimalkan agar bisa berjalan langsung di **Android via Termux**, tanpa perlu VPS maupun root.

> Satu HP lama pun bisa jadi server bot WhatsApp kamu 24/7.

---

## ✦ Fitur Utama

| | Fitur |
|---|---|
| ⚡ | Ringan & performa cepat |
| 📱 | Berjalan langsung di Android (Termux) |
| 🔌 | Sistem plugin yang mudah dikembangkan |
| 👥 | Multi-session support |
| 🛠️ | Group management tools |
| 📥 | Media downloader |
| 💾 | Session & cache management yang andal |

---

## ✦ Work On
### - Android (Termux)
### - Server/VPS/Cloud
### - Localhost/Terminal

---
## ✦ Instalasi di Android (Termux)

> Cara paling mudah menjalankan Androbot — langsung dari HP kamu.

### Langkah 0 — Persiapan

- Install **Termux** dari [F-Droid](https://f-droid.org/packages/com.termux/) *(bukan Play Store)*
- Session bersifat **opsional** (bot bisa login via QR/pairing langsung)
- Jalankan sekali: `termux-setup-storage`

---

### Langkah 1 — Jalankan Script Installer

```bash
chmod +x deploy-androbot.sh
./deploy-androbot.sh
```

Script **`deploy-androbot.sh`** akan otomatis mengurus semuanya:

```
✓  Update & install dependency (git, nodejs-lts, ffmpeg, yarn, pm2)
✓  Clone repo ke ~/androbot
✓  Tanya Session (opsional), nama bot, nomor SUDO, timezone
✓  Buat file .env otomatis
✓  Jalankan bot via PM2
```

---

### Langkah 2 — Cegah Bot Mati di Background

Android suka mematikan proses background. Lakukan ini agar bot tetap hidup:

```bash
# Aktifkan wake lock
termux-wake-lock
```

Lalu di pengaturan Android:
> **Pengaturan → Aplikasi → Termux → Baterai → Tidak Dioptimalkan**

Untuk autostart PM2 saat Termux dibuka ulang:

```bash
pm2 startup
pm2 save
```

---

## ✦ Update Bot

Kapanpun repo GitHub ada perubahan, jalankan:

```bash
bash ~/androbot/update-androbot.sh
```

Script **`update-androbot.sh`** akan:

```
→  Cek apakah ada commit baru dari GitHub
→  Jika ADA update  : yarn install + restart otomatis
→  Jika TIDAK ADA   : beri tahu kamu, tidak restart
```

Tidak ada update yang terlewat, tidak ada restart yang sia-sia.

---

## ✦ Instalasi Manual (VPS / Linux)

```bash
# Install dependency global
npm install -g yarn pm2

# Clone & masuk folder
git clone https://github.com/celode/androbot
cd androbot

# Install dependency project
yarn install

# Buat .env (lihat bagian konfigurasi di bawah)
cp .env.example .env

# Jalankan
npm start
```

---

## ✦ Konfigurasi `.env`

Buat file `.env` di root folder dengan isi berikut:


| Variable |
|---|---|
| SESSION=local | 
| USE_LOCAL_AUTH=true | 
| USE_SERVER=false | 
| MODE=public |
| HANDLERS=. |
| # opsional untuk pairing code: |
| # PAIRING_NUMBER=628xxxxxxxxxx |
---

## ✦ Perintah PM2

```bash
pm2 logs androbot        # Lihat log secara live
pm2 status               # Cek status semua proses
pm2 restart androbot     # Restart bot
pm2 stop androbot        # Stop bot
```

---

## ✦ Perintah Bot

Prefix default: `.`

| Perintah | Fungsi |
|---|---|
| `.list` | Tampilkan semua command |
| `.ping` | Cek response time |
| `.restart` | Restart bot *(sudo only)* |
| `.shutdown` | Matikan bot *(sudo only)* |

---

## ✦ Struktur Folder

```
androbot/
├── core/                  # Library inti
├── plugins/               # Plugin bot (tambahkan plugin baru di sini)
├── data/                  # Data & assets
├── .env                   # Konfigurasi (jangan di-commit!)
├── index.js               # Entry point utama
├── config.js              # Handler konfigurasi
├── deploy-androbot.sh     # 🚀 Script installer Termux
└── update-androbot.sh     # 🔄 Script updater
```

---

## ✦ Deploy di Platform Lain

| Platform | Catatan |
|---|---|
| **Termux (Android)** | Gunakan `deploy-androbot.sh` · Tidak perlu DATABASE_URL |
| **VPS / Linux** | Install manual · DATABASE_URL opsional (bisa pakai file lokal) |
| **Render / Railway** | DATABASE_URL **wajib** diisi |
| **Docker** | Tersedia `Dockerfile` di repo |

---

## ✦ Dukungan & Komunitas

- 💬 Telegram: [@raganork_in](https://t.me/raganork_in)
- 🌐 Website: [raganork.live](https://raganork.live)
- 🔑 Session Generator: tidak wajib (disarankan local auth via QR/pairing)

---

## ✦ Legal

> ⚠️ **Gunakan dengan risiko sendiri.**
>
> Bot ini menggunakan metode tidak resmi WhatsApp Web API dan **berpotensi menyebabkan pemblokiran akun**. Proyek ini tidak berafiliasi, tidak disponsori, dan tidak diendors oleh WhatsApp Inc. Dibuat semata untuk keperluan edukasi dan riset.
>
> *WhatsApp adalah merek dagang terdaftar dari WhatsApp Inc.*

---

<div align="center">

**Androbot** · Fork dari [raganork-md](https://github.com/souravkl11/raganork-md) · Lisensi GPL-3.0

*Ditenagai oleh [Baileys](https://github.com/WhiskeySockets/Baileys)*

</div>
