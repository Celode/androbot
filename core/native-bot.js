const path = require("path");
const fs = require("fs");
const qrcode = require("qrcode-terminal");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  Browsers,
  DisconnectReason,
} = require("baileys");
const { Boom } = require("@hapi/boom");
const { logger } = require("../config");
const { handler, groupUpdate, startEvent } = require("./handler");

class NativeWhatsAppBot {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.sock = null;
    this._authDir = path.join(process.cwd(), "auth_info_baileys", sessionId);
    this._initialized = false;
  }

  async initialize() {
    fs.mkdirSync(this._authDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(this._authDir);
    const { version } = await fetchLatestBaileysVersion();

    this.sock = makeWASocket({
      version,
      browser: Browsers.macOS("Desktop"),
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      defaultQueryTimeoutMs: 60_000,
      logger,
    });

    this.sock.ev.on("creds.update", saveCreds);

    this.sock.ev.on("messages.upsert", async (chatUpdate) => {
      try {
        await handler(chatUpdate, this.sock);
      } catch (error) {
        logger.error({ err: error, session: this.sessionId }, "handler failed");
      }
    });

    this.sock.ev.on("groups.update", async (updates) => {
      try {
        await groupUpdate(updates, this.sock);
      } catch (error) {
        logger.error(
          { err: error, session: this.sessionId },
          "groupUpdate failed"
        );
      }
    });

    this.sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (connection) {
        console.log(`[${this.sessionId}] Connection state: ${connection}`);
      }

      if (qr) {
        console.log(
          `\n[${this.sessionId}] Scan QR berikut di WhatsApp > Linked Devices:\n`
        );
        qrcode.generate(qr, { small: true });
      }

      if (
        process.env.PAIRING_NUMBER &&
        !this.sock.authState.creds.registered &&
        !this._pairingRequested
      ) {
        this._pairingRequested = true;
        try {
          const code = await this.sock.requestPairingCode(
            process.env.PAIRING_NUMBER.replace(/\D/g, "")
          );
          console.log(`[${this.sessionId}] Pairing code: ${code}`);
        } catch (error) {
          logger.error(
            { err: error, session: this.sessionId },
            "failed to request pairing code"
          );
        }
      }

      if (connection === "open") {
        if (!this._initialized) {
          this._initialized = true;
          try {
            await startEvent(this.sock);
          } catch (error) {
            logger.error(
              { err: error, session: this.sessionId },
              "startEvent failed"
            );
          }
        }
        console.log(`[${this.sessionId}] Connected successfully.`);
      }

      if (connection === "close") {
        const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        if (isLoggedOut) {
          console.error(
            `[${this.sessionId}] Logged out. Delete ${this._authDir} then relogin.`
          );
        } else {
          console.warn(
            `[${this.sessionId}] Connection closed (${statusCode || "unknown"}).`
          );
        }
        // Let BotManager watchdog recreate a fresh socket quickly.
        this.sock = null;
      }
    });
  }

  async sendMessage(jid, message) {
    if (!this.sock) throw new Error(`Socket not initialized for ${this.sessionId}`);
    return this.sock.sendMessage(jid, message);
  }

  async disconnect() {
    if (!this.sock) return;
    try {
      this.sock.end?.();
      this.sock.ws?.close?.();
    } catch (error) {
      logger.warn({ err: error, session: this.sessionId }, "disconnect warning");
    } finally {
      this.sock = null;
      this._initialized = false;
      this._pairingRequested = false;
    }
  }
}

module.exports = { NativeWhatsAppBot };
