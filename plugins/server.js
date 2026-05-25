const { Module } = require("../main");
const { VERSION, BOT_NAME, SESSION } = require("../config");
const os = require("os");
const axios = require("axios");
const dgram = require("dgram");
const net = require("net");

const startTime = Date.now();

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

function pingJavaDirect(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;
    let buffer = Buffer.alloc(0);

    const done = (result) => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs || 5000);
    socket.on("timeout", () => done(null));
    socket.on("error", () => done(null));

    socket.connect(parseInt(port) || 25565, host, () => {
      const portBuf = Buffer.alloc(2);
      portBuf.writeUInt16BE(parseInt(port) || 25565);
      const handshake = Buffer.concat([
        Buffer.from([0x00, 0x00]),
        Buffer.from([host.length]),
        Buffer.from(host, "utf8"),
        portBuf,
        Buffer.from([0x01]),
      ]);
      socket.write(Buffer.concat([Buffer.from([handshake.length]), handshake]));
      socket.write(Buffer.from([0x01, 0x00]));
    });

    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length > 5) done({ online: true });
    });
  });
}

async function checkMcStatusApi(host, port, edition) {
  const url = "https://api.mcstatus.io/v2/status/" + edition + "/" + host + (port ? ":" + port : "");
  const { data } = await axios.get(url, { timeout: 8000 });
  return data;
}

Module(
  {
    pattern: "status",
    fromMe: true,
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
    fromMe: true,
    desc: "Cek status server Minecraft (Java & Bedrock)",
    usage: "<ip:port> atau <domain:port>",
    use: "utility",
  },
  async (m, match) => {
    const raw = match[1] ? match[1].trim() : "";
    const defaultServer = process.env.MC_SERVER || "";
    const defaultName = process.env.MC_SERVER_NAME || "";

    let serverName = null;
    let target;

    if (raw) {
      const lastSpace = raw.lastIndexOf(" ");
      if (lastSpace !== -1 && raw.substring(lastSpace + 1).includes(":")) {
        serverName = raw.substring(0, lastSpace).trim() || null;
        target = raw.substring(lastSpace + 1).trim();
      } else {
        target = raw;
      }
    } else {
      target = defaultServer;
      serverName = defaultName || null;
    }

    if (!target) {
      const mc1 = process.env.MC_SERVER_1 || "15.235.217.54:14328";
      const mc2 = process.env.MC_SERVER_2 || "";
      let help = "*Cara pakai:*\n";
      help += "  `.mcstatus <ip:port>`\n";
      help += "  `.mcstatus <nama server> <ip:port>`\n\n";
      help += "*Contoh Bedrock:*\n";
      help += "  `.mcstatus " + mc1 + "`\n";
      help += "  `.mcstatus VentaWar " + mc1 + "`\n";
      if (mc2) help += "  `.mcstatus " + mc2 + "`\n";
      help += "\n*Contoh Java:*\n  `.mcstatus MyServer play.server.com:25565`\n\n";
      help += "💡 _Untuk MCSH: gunakan IP dari tab Network di panel, bukan domain._";
      return await m.sendReply(help);
    }

    const parts = target.split(":");
    const host = parts[0];
    const port = parts[1] || null;
    const edition = detectEdition(port);
    const mcsh = isMcshDomain(host);

    if (mcsh && !isIpAddress(host)) {
      return await m.sendReply(
        "⚠️ *Domain MCSH terdeteksi*\n\n" +
        "_Domain_ `" + host + "` _diblokir untuk status query dari server cloud._\n\n" +
        "*Gunakan IP langsung dari panel MCSH:*\n" +
        "1. Login ke panel MCSH\n" +
        "2. Pilih server → tab *Network*\n" +
        "3. Salin IP dan port yang tertera\n" +
        "4. Ketik: `.mcstatus <ip>:<port>`\n\n" +
        "_Contoh: `.mcstatus 15.235.217.54:14328`_"
      );
    }

    const label = serverName ? serverName + " (" + target + ")" : target;
    await m.sendReply("_Mengecek_ `" + label + "` _(" + (edition || "auto-detect") + ")..._");

    const t0 = Date.now();

    try {
      if (edition === "bedrock" || (!edition && port)) {
        const result = await pingBedrockDirect(host, port || "19132", 6000);

        if (result && result.online) {
          const latency = Date.now() - t0;
          let msg = "*━━━「 MINECRAFT SERVER 」━━━*\n\n";
          if (serverName) msg += "🏷️ *Nama:* " + serverName + "\n";
          msg += "🟢 *Status:* ONLINE\n";
          msg += "🌐 *Alamat:* " + target + "\n";
          msg += "🎯 *Edition:* Bedrock\n";
          if (result.motd) msg += "📋 *MOTD:* " + result.motd.replace(/§./g, "") + "\n";
          if (result.version) msg += "🎮 *Versi:* " + result.version + "\n";
          msg += "👤 *Pemain:* " + result.onlinePlayers + " / " + result.maxPlayers + "\n";
          if (result.gameMode) msg += "🎲 *Mode:* " + result.gameMode + "\n";
          msg += "⚡ *Latensi:* " + latency + " ms\n";
          return await m.sendReply(msg);
        }

        let msg = "*━━━「 MINECRAFT SERVER 」━━━*\n\n";
        if (serverName) msg += "🏷️ *Nama:* " + serverName + "\n";
        msg += "🔴 *Status:* OFFLINE\n";
        msg += "🌐 *Alamat:* " + target + "\n";
        msg += "🎯 *Edition:* Bedrock\n\n";
        msg += "_Server tidak merespons. Pastikan server sedang berjalan._";
        return await m.sendReply(msg);
      }

      const apiData = await checkMcStatusApi(host, port, "java");
      if (apiData && apiData.online) {
        const latency = Date.now() - t0;
        const pl = apiData.players || {};
        let msg = "*━━━「 MINECRAFT SERVER 」━━━*\n\n";
        if (serverName) msg += "🏷️ *Nama:* " + serverName + "\n";
        msg += "🟢 *Status:* ONLINE\n";
        msg += "🌐 *Alamat:* " + target + "\n";
        msg += "🎯 *Edition:* Java\n";
        if (apiData.motd) msg += "📋 *MOTD:* " + (apiData.motd.clean || "") + "\n";
        if (apiData.version) msg += "🎮 *Versi:* " + (apiData.version.name_clean || apiData.version.name) + "\n";
        msg += "👤 *Pemain:* " + (pl.online || 0) + " / " + (pl.max || 0) + "\n";
        msg += "⚡ *Latensi:* " + latency + " ms\n";
        return await m.sendReply(msg);
      }

      let msg = "*━━━「 MINECRAFT SERVER 」━━━*\n\n";
      if (serverName) msg += "🏷️ *Nama:* " + serverName + "\n";
      msg += "🔴 *Status:* OFFLINE\n";
      msg += "🌐 *Alamat:* " + target + "\n\n";
      msg += "_Server tidak merespons._";
      return await m.sendReply(msg);

    } catch (err) {
      return await m.sendReply("_Gagal mengecek server._\n_Error: " + err.message + "_");
    }
  }
);
