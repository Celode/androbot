const { Module } = require("../main");
const { VERSION, BOT_NAME, SESSION } = require("../config");
const os = require("os");
const axios = require("axios");

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

Module(
  {
    pattern: "status",
    fromMe: true,
    desc: "Show bot status, uptime, and system info",
    use: "system",
  },
  async (m) => {
    const uptime = Date.now() - startTime;
    const mem = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpuLoad = os.loadavg()[0].toFixed(2);
    const ping = Date.now();

    const sessions = SESSION.length;

    let msg = "*━━━「 BOT STATUS 」━━━*\n\n";
    msg += "🤖 *Bot:* " + BOT_NAME + " v" + VERSION + "\n";
    msg += "⏱️ *Uptime:* " + formatUptime(uptime) + "\n";
    msg += "📡 *Sessions:* " + sessions + " aktif\n";
    msg += "⚡ *Ping:* " + (Date.now() - ping) + " ms\n";
    msg += "\n*━━━「 SYSTEM 」━━━*\n\n";
    msg += "🖥️ *Platform:* " + os.platform() + " (" + os.arch() + ")\n";
    msg += "🧠 *RAM Used:* " + bytesToMB(mem.heapUsed) + " / " + bytesToMB(mem.heapTotal) + "\n";
    msg += "💾 *System RAM:* " + bytesToMB(usedMem) + " / " + bytesToMB(totalMem) + "\n";
    msg += "📊 *CPU Load:* " + cpuLoad + "\n";
    msg += "🟢 *Node.js:* " + process.version + "\n";

    await m.sendReply(msg);
  }
);

Module(
  {
    pattern: "mcstatus ?(.*)",
    fromMe: true,
    desc: "Cek status server Minecraft",
    usage: "<ip:port> atau <ip>",
    use: "utility",
  },
  async (m, match) => {
    const input = match[1] ? match[1].trim() : "";

    const defaultServer = process.env.MC_SERVER || "";

    const target = input || defaultServer;

    if (!target) {
      return await m.sendReply(
        "*Cara pakai:* .mcstatus <ip>\n" +
        "*Contoh:* .mcstatus play.example.com\n\n" +
        "_Atau set env_ `MC_SERVER` _dengan IP server default kamu._"
      );
    }

    await m.sendReply("_Mengecek server_ `" + target + "` _..._");

    try {
      const [host, port] = target.includes(":") ? target.split(":") : [target, null];
      const apiUrl = "https://api.mcstatus.io/v2/status/java/" + host + (port ? ":" + port : "");

      const { data } = await axios.get(apiUrl, { timeout: 10000 });

      if (!data.online) {
        return await m.sendReply(
          "*━━━「 MINECRAFT SERVER 」━━━*\n\n" +
          "🔴 *Status:* OFFLINE\n" +
          "🌐 *Server:* " + target + "\n\n" +
          "_Server tidak dapat dijangkau saat ini._"
        );
      }

      const players = data.players || {};
      const version = data.version ? data.version.name_clean || data.version.name : "Unknown";
      const motd = data.motd ? data.motd.clean || "" : "";
      const onlinePlayers = players.online || 0;
      const maxPlayers = players.max || 0;

      let playerList = "";
      if (players.list && players.list.length > 0) {
        const names = players.list.slice(0, 10).map((p) => p.name_clean || p.name).join(", ");
        playerList = "\n👥 *Online:* " + names;
        if (players.list.length > 10) {
          playerList += " _(+" + (players.list.length - 10) + " lainnya)_";
        }
      }

      let msg = "*━━━「 MINECRAFT SERVER 」━━━*\n\n";
      msg += "🟢 *Status:* ONLINE\n";
      msg += "🌐 *Server:* " + target + "\n";
      msg += "📋 *MOTD:* " + (motd || "—") + "\n";
      msg += "🎮 *Versi:* " + version + "\n";
      msg += "👤 *Pemain:* " + onlinePlayers + " / " + maxPlayers;
      msg += playerList + "\n";
      if (data.latency) msg += "⚡ *Latensi:* " + data.latency + " ms\n";

      await m.sendReply(msg);
    } catch (err) {
      if (err.response && err.response.status === 400) {
        return await m.sendReply("_Format IP tidak valid. Contoh: play.example.com atau play.example.com:25565_");
      }
      return await m.sendReply("_Gagal mengecek server. Pastikan IP benar dan coba lagi._\n_Error: " + err.message + "_");
    }
  }
);
