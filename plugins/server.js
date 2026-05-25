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

function detectEdition(port) {
  if (!port) return null;
  return BEDROCK_PORTS.includes(String(port)) ? "bedrock" : "java";
}

function pingBedrockDirect(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket("udp4");
    let resolved = false;

    const timer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      socket.close();
      resolve(null);
    }, timeoutMs || 5000);

    const unconnectedPing = Buffer.from([
      0x01,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0xff, 0xff, 0x00, 0xfe, 0xfe, 0xfe, 0xfe,
      0xfd, 0xfd, 0xfd, 0xfd, 0x12, 0x34, 0x56, 0x78,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);

    socket.on("message", (msg) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      socket.close();
      try {
        const str = msg.toString("utf8", 35);
        const parts = str.split(";");
        resolve({
          online: true,
          motd: parts[1] || "",
          version: parts[3] || "",
          onlinePlayers: parseInt(parts[4]) || 0,
          maxPlayers: parseInt(parts[5]) || 0,
          gameMode: parts[8] || "",
        });
      } catch (_) {
        resolve({ online: true, motd: "", version: "", onlinePlayers: 0, maxPlayers: 0 });
      }
    });

    socket.on("error", () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      socket.close();
      resolve(null);
    });

    socket.send(unconnectedPing, 0, unconnectedPing.length, parseInt(port) || 19132, host, (err) => {
      if (err && !resolved) {
        resolved = true;
        clearTimeout(timer);
        socket.close();
        resolve(null);
      }
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
        Buffer.from([0x00]),
        Buffer.from([0x00]),
        Buffer.from([host.length]),
        Buffer.from(host, "utf8"),
        portBuf,
        Buffer.from([0x01]),
      ]);
      const lenBuf = Buffer.from([handshake.length]);
      socket.write(Buffer.concat([lenBuf, handshake]));
      socket.write(Buffer.from([0x01, 0x00]));
    });

    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length > 5) {
        done({ online: true });
      }
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
    desc: "Cek status server Minecraft langsung (Java & Bedrock)",
    usage: "<ip:port>",
    use: "utility",
  },
  async (m, match) => {
    const input = match[1] ? match[1].trim() : "";
    const defaultServer = process.env.MC_SERVER || "";
    const target = input || defaultServer;

    if (!target) {
      return await m.sendReply(
        "*Cara pakai:* .mcstatus <ip:port>\n\n" +
        "*Contoh Bedrock:*\n  .mcstatus 103.x.x.x:19132\n\n" +
        "*Contoh Java:*\n  .mcstatus 103.x.x.x:25565\n\n" +
        "⚠️ _Gunakan IP numerik, bukan domain, jika domain tidak bisa diakses dari luar Indonesia._\n\n" +
        "_Cek IP server kamu di panel MCSH._"
      );
    }

    const parts = target.split(":");
    const host = parts[0];
    const port = parts[1] || null;
    const edition = detectEdition(port);

    await m.sendReply("_Mengecek_ `" + target + "` _(" + (edition || "auto") + ")..._");

    const t0 = Date.now();

    try {
      if (edition === "bedrock" || (!edition && port)) {
        const result = await pingBedrockDirect(host, port || "19132", 6000);

        if (result && result.online) {
          const latency = Date.now() - t0;
          let msg = "*━━━「 MINECRAFT SERVER 」━━━*\n\n";
          msg += "🟢 *Status:* ONLINE\n";
          msg += "🌐 *Server:* " + target + "\n";
          msg += "🎯 *Edition:* Bedrock\n";
          if (result.motd) msg += "📋 *MOTD:* " + result.motd.replace(/§./g, "") + "\n";
          if (result.version) msg += "🎮 *Versi:* " + result.version + "\n";
          msg += "👤 *Pemain:* " + result.onlinePlayers + " / " + result.maxPlayers + "\n";
          if (result.gameMode) msg += "🎲 *Mode:* " + result.gameMode + "\n";
          msg += "⚡ *Latensi:* " + latency + " ms\n";
          return await m.sendReply(msg);
        }

        if (!edition) {
          const javaResult = await pingJavaDirect(host, port || "25565", 5000);
          if (javaResult && javaResult.online) {
            try {
              const apiData = await checkMcStatusApi(host, port, "java");
              if (apiData && apiData.online) {
                const latency = Date.now() - t0;
                let msg = "*━━━「 MINECRAFT SERVER 」━━━*\n\n";
                msg += "🟢 *Status:* ONLINE\n";
                msg += "🌐 *Server:* " + target + "\n";
                msg += "🎯 *Edition:* Java\n";
                if (apiData.motd) msg += "📋 *MOTD:* " + (apiData.motd.clean || "") + "\n";
                if (apiData.version) msg += "🎮 *Versi:* " + (apiData.version.name_clean || apiData.version.name) + "\n";
                const pl = apiData.players || {};
                msg += "👤 *Pemain:* " + (pl.online || 0) + " / " + (pl.max || 0) + "\n";
                msg += "⚡ *Latensi:* " + latency + " ms\n";
                return await m.sendReply(msg);
              }
            } catch (_) {}
            const latency = Date.now() - t0;
            let msg = "*━━━「 MINECRAFT SERVER 」━━━*\n\n";
            msg += "🟢 *Status:* ONLINE _(koneksi berhasil)_\n";
            msg += "🌐 *Server:* " + target + "\n";
            msg += "🎯 *Edition:* Java\n";
            msg += "⚡ *Latensi:* " + latency + " ms\n";
            return await m.sendReply(msg);
          }
        }

        return await m.sendReply(
          "*━━━「 MINECRAFT SERVER 」━━━*\n\n" +
          "🔴 *Status:* OFFLINE\n" +
          "🌐 *Server:* " + target + "\n" +
          "🎯 *Edition:* " + (edition || "Bedrock/Java") + "\n\n" +
          "_Server tidak merespons. Pastikan IP dan port benar._\n\n" +
          "💡 _Tip: Jika domain tidak bisa diakses, coba gunakan IP numerik dari panel MCSH._"
        );
      }

      const apiData = await checkMcStatusApi(host, port, "java");
      if (apiData && apiData.online) {
        const latency = Date.now() - t0;
        const pl = apiData.players || {};
        let msg = "*━━━「 MINECRAFT SERVER 」━━━*\n\n";
        msg += "🟢 *Status:* ONLINE\n";
        msg += "🌐 *Server:* " + target + "\n";
        msg += "🎯 *Edition:* Java\n";
        if (apiData.motd) msg += "📋 *MOTD:* " + (apiData.motd.clean || "") + "\n";
        if (apiData.version) msg += "🎮 *Versi:* " + (apiData.version.name_clean || apiData.version.name) + "\n";
        msg += "👤 *Pemain:* " + (pl.online || 0) + " / " + (pl.max || 0) + "\n";
        msg += "⚡ *Latensi:* " + latency + " ms\n";
        return await m.sendReply(msg);
      }

      return await m.sendReply(
        "*━━━「 MINECRAFT SERVER 」━━━*\n\n" +
        "🔴 *Status:* OFFLINE\n" +
        "🌐 *Server:* " + target + "\n\n" +
        "_Server tidak merespons._"
      );

    } catch (err) {
      return await m.sendReply(
        "_Gagal mengecek server._\n_Error: " + err.message + "_"
      );
    }
  }
);
