'use strict';

const { spawn } = require('child_process');

class SystemdNotifier {
    constructor(options = {}) {
        this.notifySocket = options.notifySocket ?? process.env.NOTIFY_SOCKET;
        this.watchdogIntervalMs = options.watchdogIntervalMs || 10000;
        this.spawnProcess = options.spawnProcess || spawn;
        this.watchdogTimer = null;
        this.disabled = !this.notifySocket;
        this.failureLogged = false;
    }

    _send(args) {
        if (this.disabled) return Promise.resolve(false);

        return new Promise(resolve => {
            const child = this.spawnProcess('systemd-notify', args, {
                stdio: 'ignore',
                windowsHide: true,
                env: process.env
            });
            child.once('error', error => {
                if (!this.failureLogged) {
                    this.failureLogged = true;
                    console.warn(`[SystemdNotify] systemd-notify unavailable: ${error.message}`);
                }
                this.disabled = true;
                resolve(false);
            });
            child.once('exit', (code, signal) => {
                const sent = code === 0;
                if (!sent && !this.failureLogged) {
                    this.failureLogged = true;
                    console.warn(
                        `[SystemdNotify] notification failed: `
                        + `operation=${args[0] || 'unknown'}, code=${code}, signal=${signal || 'none'}`
                    );
                }
                resolve(sent);
            });
        });
    }

    async ready(status = 'VCPToolBox is ready') {
        const sent = await this._send(['--ready', `--status=${status}`]);
        if (sent) this.startWatchdog();
        return sent;
    }

    status(message) {
        return this._send([`--status=${String(message).slice(0, 240)}`]);
    }

    watchdog() {
        // systemd-notify has no portable --watchdog flag. WATCHDOG=1 is the
        // sd_notify protocol field supported across systemd releases.
        return this._send(['WATCHDOG=1']);
    }

    startWatchdog() {
        if (this.watchdogTimer || this.disabled) return;
        this.watchdogTimer = setInterval(() => {
            this.watchdog().catch(() => {});
        }, this.watchdogIntervalMs);
        this.watchdogTimer.unref?.();
    }

    async stopping(status = 'VCPToolBox is stopping') {
        this.stopWatchdog();
        return this._send(['--stopping', `--status=${status}`]);
    }

    stopWatchdog() {
        if (this.watchdogTimer) {
            clearInterval(this.watchdogTimer);
            this.watchdogTimer = null;
        }
    }
}

module.exports = SystemdNotifier;
