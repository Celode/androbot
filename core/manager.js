const { WhatsAppBot } = require("./bot");
const { logger, SESSION } = require('../config');
const { sequelize } = require("./database");
const { CustomAuthState } = require("./auth");
const { flushQueueOnShutdown, stopFlushTimer } = require("./store");

const WATCHDOG_INTERVAL_MS = parseInt(process.env.WATCHDOG_INTERVAL_MS || "300000", 10);

class BotManager {
    constructor() {
        this.bots = new Map();
        this._watchdogTimer = null;
        this._reconnecting = new Set();
        this._stopping = false;
    }

    async initializeBots() {
        logger.info({ sessions: SESSION }, `Initializing all configured bots.`);
        await CustomAuthState.deleteGarbageSessions(SESSION);        
        for (const sessionId of SESSION) {
            try {
                logger.info({ session: sessionId }, `Attempting to initialize bot for session.`);
                const bot = new WhatsAppBot(sessionId);
                await bot.initialize(); 
                if (bot.sock) { 
                    this.bots.set(sessionId, bot);
                    logger.info({ session: sessionId }, `Bot initialization scheduled. Connection status will follow.`);
                } else {
                    logger.error({ session: sessionId }, `Bot object for session could not be initialized (sock is null).`);
                }
            } catch (error) {
                logger.error({ session: sessionId, err: error }, `Overall failure to initialize bot in BotManager`);
            }
        }
    }

    async reconnectBot(sessionId) {
        if (this._reconnecting.has(sessionId) || this._stopping) return;
        this._reconnecting.add(sessionId);

        console.log(`[Watchdog] Attempting reconnect for session: ${sessionId}`);
        logger.info({ session: sessionId }, `Watchdog: reconnecting bot.`);

        const oldBot = this.bots.get(sessionId);
        if (oldBot) {
            try {
                await oldBot.disconnect(false);
            } catch (_) {}
            this.bots.delete(sessionId);
        }

        try {
            const bot = new WhatsAppBot(sessionId);
            await bot.initialize();
            if (bot.sock) {
                this.bots.set(sessionId, bot);
                console.log(`[Watchdog] ✅ Reconnected session: ${sessionId}`);
                logger.info({ session: sessionId }, `Watchdog: bot reconnected successfully.`);
            } else {
                console.warn(`[Watchdog] ⚠️ Reconnect failed (sock null) for session: ${sessionId}`);
                logger.warn({ session: sessionId }, `Watchdog: reconnect resulted in null sock.`);
            }
        } catch (error) {
            console.error(`[Watchdog] ❌ Reconnect error for session ${sessionId}:`, error.message);
            logger.error({ session: sessionId, err: error }, `Watchdog: reconnect threw error.`);
        } finally {
            this._reconnecting.delete(sessionId);
        }
    }

    startWatchdog() {
        if (this._watchdogTimer) return;
        console.log(`[Watchdog] Started — checking every ${WATCHDOG_INTERVAL_MS / 1000}s`);
        this._watchdogTimer = setInterval(async () => {
            if (this._stopping) return;
            for (const sessionId of SESSION) {
                const bot = this.bots.get(sessionId);
                const isDown = !bot || !bot.sock;
                if (isDown) {
                    console.log(`[Watchdog] Session ${sessionId} appears disconnected. Reconnecting...`);
                    await this.reconnectBot(sessionId);
                }
            }
        }, WATCHDOG_INTERVAL_MS);
    }

    stopWatchdog() {
        if (this._watchdogTimer) {
            clearInterval(this._watchdogTimer);
            this._watchdogTimer = null;
            console.log(`[Watchdog] Stopped.`);
        }
    }

    getBot(sessionId) {
        return this.bots.get(sessionId);
    }

    async sendMessage(sessionId, jid, message) {
        const bot = this.getBot(sessionId);
        if (!bot) {
            throw new Error(`No bot found or initialized for session: ${sessionId}`);
        }
        return await bot.sendMessage(jid, message);
    }

    async shutdown() {
        this._stopping = true;
        logger.info('Shutting down all bots...');

        this.stopWatchdog();

        try {
            stopFlushTimer();
            await flushQueueOnShutdown();
        } catch (err) {
            logger.error({ err }, "Failed to flush message queue during shutdown");
        }

        try {
            logger.info("Saving all session data before shutdown...");
            await CustomAuthState.saveAllSessions();
            logger.info("All session data saved successfully");
        } catch (error) {
            logger.error({ err: error }, "Error saving sessions during shutdown");
        }

        for (const [sessionId, bot] of this.bots.entries()) {
            try {
                await bot.disconnect(false); 
                logger.info({ session: sessionId }, `Bot disconnected successfully.`);
            } catch (error) {
                logger.error({ session: sessionId, err: error }, `Error during bot disconnection.`);
            }
        }
        this.bots.clear(); 

        try {
            CustomAuthState.stopPeriodicSave();
            logger.info('Auth periodic save timer stopped');
        } catch (error) {
            logger.error({ err: error }, 'Error stopping periodic save timer');
        }

        try {
            const Schedule = require('./schedulers');
            await Schedule.cleanup();
            logger.info('Scheduled tasks cleaned up');
        } catch (error) {
            logger.error({ err: error }, 'Error cleaning up scheduled tasks');
        }

        if (sequelize) {
            try {
                await sequelize.close();
                logger.info('Database connection closed.');
            } catch (error) {
                logger.error({ err: error }, 'Error closing database connection.');
            }
        }
    }
}

module.exports = { BotManager };
