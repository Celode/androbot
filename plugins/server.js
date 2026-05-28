const { Module } = require("../main");
const { VERSION, BOT_NAME, SESSION, MODE } = require("../config");
const isPrivateMode = MODE === "private";
const os = require("os");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const dgram = require("dgram");
const net = require("net");

const startTime = Date.now();
const SERVERS_FILE = path.join(__dirname, "../data/mc_servers.json");

function loadServers() {
  try {
    if (fs.existsSync(SERVERS_FILE)) {
      return JSON.parse(fs.readFileSync(SERVERS_FILE, "utf8"));
    }
  } catch (_) {}
  return {};
}

function saveServers(data) {
  fs.mkdirSync(path.dirname(SERVERS_FILE), { recursive: true });
  fs.writeFileSync(SERVERS_FILE, JSON.stringify(data, null, 2));
}

function formatUptime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const parts = [];
  if (days > 0) parts.push(days + "d");
  if (hours > 0) parts.push(hours + "h");
  if (mins > 0) parts.push(mins + "m");
  parts.push(secs + "s");
  return parts.join(" ");
}

function bytesToMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

const BEDROCK_PORTS = ["19132", "19133"];
const JAVA_PORTS = ["25565", "25566"];

function detectEdition(port) {
  if (!port) return null;
  if (BEDROCK_PORTS.includes(String(port))) return "bedrock";
  if (JAVA_PORTS.includes(String(port))) return "java";
  return null;
}

function isMcshDomain(host) {
  return typeof host === "string" && /mcsh\.(com|id)/i.test(host);
}

function isIpAddress(host) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

function isAddress(str) {
  return str.includes(":") || isIpAddress(str);
}

function pingBedrockDirect(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket("udp4");
    let resolved = false;

    const finish = (val) => {
      if (resolved) return;
      resolved = true;
      try { socket.close(); } catch (_) {}
      resolve(val);
    };

    setTimeout(() => finish(null), timeoutMs || 6000);

    const unconnectedPing = Buffer.from([
      0x01,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0xff, 0xff, 0x00, 0xfe, 0xfe, 0xfe, 0xfe,
      0xfd, 0xfd, 0xfd, 0xfd, 0x12, 0x34, 0x56, 0x78,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);

    socket.on("message", (msg) => {
      try {
        const str = msg.toString("utf8", 35);
        const parts = str.split(";");
        finish({
          online: true,
          motd: parts[1] || "",
          version: parts[3] || "",
          onlinePlayers: parseInt(parts[4]) || 0,
          maxPlayers: parseInt(parts[5]) || 0,
          gameMode: parts[8] || "",
        });
      } catch (_) {
        finish({ online: true, motd: "", version: "", onlinePlayers: 0, maxPlayers: 0 });
      }
    });

    socket.on("error", () => finish(null));

    socket.send(unconnectedPing, 0, unconnectedPing.length, parseInt(port) || 19132, host, (err) => {
      if (err) finish(null);
    });
  });
}

async function checkMcStatusApi(host, port, edition) {
  const url = "https://api.mcstatus.io/v2/status/" + edition + "/" + host + (port ? ":" + port : "");
  const { data } = await axios.get(url, { timeout: 8000 });
  return data;
}

async function checkServer(target, serverName) {
  const parts = target.split(":");
  const host = parts[0];
  const port = parts[1] || null;
  const edition = detectEdition(port);
  const mcsh = isMcshDomain(host);

  if (mcsh && !isIpAddress(host)) {
    return {
      blocked: true,
      host,
      target,
      serverName,
    };
  }

  const t0 = Date.now();

  if (edition === "bedrock" || (!edition && port)) {
    const result = await pingBedrockDirect(host, port || "19132", 6000);
    const latency = Date.now() - t0;
    return {
      edition: "Bedrock",
      target,
      serverName,
      latency,
      ...(result || { online: false }),
    };
  }

  try {
    const apiData = await checkMcStatusApi(host, port, "java");
    const latency = Date.now() - t0;
    if (apiData && apiData.online) {
      const pl = apiData.players || {};
      return {
        edition: "Java",
        online: true,
        target,
        serverName,
        latency,
        motd: apiData.motd ? (apiData.motd.clean || "") : "",
        version: apiData.version ? (apiData.version.name_clean || apiData.version.name || "") : "",
        onlinePlayers: pl.online || 0,
        maxPlayers: pl.max || 0,
        gameMode: "",
      };
    }
    return { edition: "Java", online: false, target, serverName, latency };
  } catch (_) {
    return { edition: "Java", online: false, target, serverName, latency: Date.now() - t0 };
  }
}

function buildResultMsg(r) {
  if (r.blocked) {
    return (
      "*━━━「 MINECRAFT SERVER 」━━━*\n\n" +
      "⚠️ *Domain MCSH terdeteksi*\n\n" +
      "_Domain_ `" + r.host + "` _diblokir dari IP cloud._\n" +
      "Gunakan IP dari tab *Network* di panel MCSH.\n\n" +
      "_Contoh: `.mcstatus Ventela 15.235.217.54:14328`_"
    );
  }

  let msg = "*━━━「 MINECRAFT SERVER 」━━━*\n\n";
  if (r.serverName) msg += "🏷️ *Nama:* " + r.serverName + "\n";
  msg += (r.online ? "🟢" : "🔴") + " *Status:* " + (r.online ? "ONLINE" : "OFFLINE") + "\n";
  msg += "🌐 *Alamat:* " + r.target + "\n";
  if (r.edition) msg += "🎯 *Edition:* " + r.edition + "\n";
  if (r.online) {
    if (r.motd) msg += "📋 *MOTD:* " + r.motd.replace(/§./g, "") + "\n";
    if (r.version) msg += "🎮 *Versi:* " + r.version + "\n";
    msg += "👤 *Pemain:* " + (r.onlinePlayers || 0) + " / " + (r.maxPlayers || 0) + "\n";
    if (r.gameMode) msg += "🎲 *Mode:* " + r.gameMode + "\n";
    msg += "⚡ *Latensi:* " + r.latency + " ms\n";
  } else {
    msg += "\n_Server tidak merespons. Pastikan server sedang berjalan._";
  }
  return msg;
}

Module(
  {
    pattern: "status",
    fromMe: isPrivateMode,
    desc: "Tampilkan status bot, uptime, dan info sistem",
    use: "system",
  },
  async (m) => {
    const uptime = Date.now() - startTime;
    const mem = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpuLoad = os.loadavg()[0].toFixed(2);
    const pingStart = Date.now();
    const sessions = SESSION.length;

    let msg = "*━━━「 BOT STATUS 」━━━*\n\n";
    msg += "🤖 *Bot:* " + BOT_NAME + " v" + VERSION + "\n";
    msg += "⏱️ *Uptime:* " + formatUptime(uptime) + "\n";
    msg += "📡 *Sessions:* " + sessions + " aktif\n";
    msg += "⚡ *Ping:* " + (Date.now() - pingStart) + " ms\n";
    msg += "\n*━━━「 SYSTEM 」━━━*\n\n";
    msg += "🖥️ *Platform:* " + os.platform() + " (" + os.arch() + ")\n";
    msg += "🧠 *RAM Bot:* " + bytesToMB(mem.heapUsed) + " / " + bytesToMB(mem.heapTotal) + "\n";
    msg += "💾 *RAM Sistem:* " + bytesToMB(usedMem) + " / " + bytesToMB(totalMem) + "\n";
    msg += "📊 *CPU Load:* " + cpuLoad + "\n";
    msg += "🟢 *Node.js:* " + process.version + "\n";

    await m.sendReply(msg);
  }
);

Module(
  {
    pattern: "mcstatus ?(.*)",
    fromMe: isPrivateMode,
    desc: "Cek status server Minecraft by nama atau IP",
    usage: "<nama> | <ip:port> | <nama> <ip:port>",
    use: "utility",
  },
  async (m, match) => {
    const raw = match[1] ? match[1].trim() : "";
    const servers = loadServers();

    if (!raw) {
      const keys = Object.keys(servers);
      let help = "*Cara pakai:*\n";
      help += "  `.mcstatus <nama>` — cek server tersimpan\n";
      help += "  `.mcstatus <ip:port>` — cek langsung\n";
      help += "  `.mcstatus <nama> <ip:port>` — cek dengan label\n\n";
      if (keys.length > 0) {
        help += "*Server tersimpan:*\n";
        keys.forEach((k) => {
          help += "  • `" + servers[k].name + "` → " + servers[k].address + "\n";
        });
        help += "\n";
      }
      help += "*Kelola server:*\n";
      help += "  `.mcsave <nama> <ip:port>` — simpan server\n";
      help += "  `.mcdelete <nama>` — hapus server\n";
      help += "  `.mclist` — daftar server tersimpan\n\n";
      help += "💡 _MCSH: gunakan IP dari tab Network di panel._";
      return await m.sendReply(help);
    }

    const key = raw.toLowerCase().replace(/\s+/g, "");
    if (servers[key]) {
      const s = servers[key];
      await m.sendReply("_Mengecek_ *" + s.name + "* _(" + s.address + ")..._");
      const result = await checkServer(s.address, s.name);
      return await m.sendReply(buildResultMsg(result));
    }

    const lastSpace = raw.lastIndexOf(" ");
    let serverName = null;
    let target;

    if (lastSpace !== -1 && isAddress(raw.substring(lastSpace + 1))) {
      serverName = raw.substring(0, lastSpace).trim() || null;
      target = raw.substring(lastSpace + 1).trim();
    } else if (isAddress(raw)) {
      target = raw;
    } else {
      const fuzzy = Object.keys(servers).find((k) =>
        k.includes(raw.toLowerCase()) || servers[k].name.toLowerCase().includes(raw.toLowerCase())
      );
      if (fuzzy) {
        const s = servers[fuzzy];
        await m.sendReply("_Mengecek_ *" + s.name + "* _(" + s.address + ")..._");
        const result = await checkServer(s.address, s.name);
        return await m.sendReply(buildResultMsg(result));
      }
      return await m.sendReply(
        "❌ Server *" + raw + "* tidak ditemukan.\n\n" +
        "Gunakan `.mcsave " + raw + " <ip:port>` untuk menyimpannya dulu.\n" +
        "Atau `.mclist` untuk melihat daftar server tersimpan."
      );
    }

    await m.sendReply("_Mengecek_ `" + (serverName ? serverName + " (" + target + ")" : target) + "`..._");
    const result = await checkServer(target, serverName);
    return await m.sendReply(buildResultMsg(result));
  }
);

Module(
  {
    pattern: "mcsave ?(.*)",
    fromMe: isPrivateMode,
    desc: "Simpan server Minecraft dengan nama alias",
    usage: "<nama> <ip:port>",
    use: "utility",
  },
  async (m, match) => {
    const raw = match[1] ? match[1].trim() : "";
    if (!raw) {
      return await m.sendReply("*Cara pakai:* `.mcsave <nama> <ip:port>`\n\n_Contoh:_\n`.mcsave Ventela 15.235.217.54:14328`\n`.mcsave VentelaWar 15.235.217.54:19135`");
    }

    const lastSpace = raw.lastIndexOf(" ");
    if (lastSpace === -1 || !isAddress(raw.substring(lastSpace + 1))) {
      return await m.sendReply("❌ Format salah.\n*Cara pakai:* `.mcsave <nama> <ip:port>`\n\n_Contoh:_ `.mcsave Ventela 15.235.217.54:14328`");
    }

    const name = raw.substring(0, lastSpace).trim();
    const address = raw.substring(lastSpace + 1).trim();
    const key = name.toLowerCase().replace(/\s+/g, "");

    const servers = loadServers();
    const isUpdate = !!servers[key];
    servers[key] = { name, address };
    saveServers(servers);

    await m.sendReply(
      (isUpdate ? "✏️ *Server diperbarui!*" : "✅ *Server disimpan!*") + "\n\n" +
      "🏷️ *Nama:* " + name + "\n" +
      "🌐 *Alamat:* " + address + "\n\n" +
      "_Sekarang cukup ketik_ `.mcstatus " + name + "`"
    );
  }
);

Module(
  {
    pattern: "mcdelete ?(.*)",
    fromMe: isPrivateMode,
    desc: "Hapus server Minecraft dari daftar",
    usage: "<nama>",
    use: "utility",
  },
  async (m, match) => {
    const raw = match[1] ? match[1].trim() : "";
    if (!raw) {
      return await m.sendReply("*Cara pakai:* `.mcdelete <nama>`\n\nGunakan `.mclist` untuk melihat daftar server.");
    }

    const key = raw.toLowerCase().replace(/\s+/g, "");
    const servers = loadServers();

    if (!servers[key]) {
      const fuzzy = Object.keys(servers).find((k) =>
        k.includes(raw.toLowerCase()) || servers[k].name.toLowerCase().includes(raw.toLowerCase())
      );
      if (fuzzy) {
        const name = servers[fuzzy].name;
        delete servers[fuzzy];
        saveServers(servers);
        return await m.sendReply("🗑️ *Server* " + name + " *dihapus.*");
      }
      return await m.sendReply("❌ Server *" + raw + "* tidak ditemukan.\n\nGunakan `.mclist` untuk melihat daftar.");
    }

    const name = servers[key].name;
    delete servers[key];
    saveServers(servers);
    await m.sendReply("🗑️ *Server* " + name + " *berhasil dihapus.*");
  }
);

Module(
  {
    pattern: "mclist",
    fromMe: isPrivateMode,
    desc: "Tampilkan daftar server Minecraft tersimpan",
    use: "utility",
  },
  async (m) => {
    const servers = loadServers();
    const keys = Object.keys(servers);

    if (keys.length === 0) {
      return await m.sendReply(
        "📋 *Daftar server kosong.*\n\n" +
        "Tambahkan dengan:\n`.mcsave <nama> <ip:port>`\n\n" +
        "_Contoh:_ `.mcsave Ventela 15.235.217.54:14328`"
      );
    }

    let msg = "*━━━「 SERVER MINECRAFT 」━━━*\n\n";
    keys.forEach((k, i) => {
      msg += (i + 1) + ". *" + servers[k].name + "*\n";
      msg += "   `" + servers[k].address + "`\n";
    });
    msg += "\n_Ketik_ `.mcstatus <nama>` _untuk cek status._";
    await m.sendReply(msg);
  }
);
