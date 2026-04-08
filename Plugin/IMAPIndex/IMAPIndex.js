require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const TurndownService = require('turndown');
const net = require('net');
const { runPostScripts } = require('./post_run');

// --- Constants ---
const APP_ROOT = path.resolve(__dirname);
const STORAGE_PATH = path.resolve(APP_ROOT, process.env.STORAGE_PATH || 'mail_store');
// --- End Constants ---

const imapConfig = {
    user: process.env.IMAP_USER,
    password: process.env.IMAP_PASS,
    host: process.env.IMAP_HOST,
    port: parseInt(process.env.IMAP_PORT, 10),
    tls: process.env.IMAP_TLS === 'true',
    proxy: {
        enabled: process.env.IMAP_PROXY_ENABLED === 'true',
        url: process.env.IMAP_PROXY_URL,
        timeout: parseInt(process.env.IMAP_PROXY_TIMEOUT_MS, 10) || 10000,
        rejectUnauthorized: process.env.IMAP_PROXY_TLS_REJECT_UNAUTHORIZED !== 'false',
    }
};

const uidIndexPath = path.join(STORAGE_PATH, 'uid.index');

async function rebuildUidIndex() {
    const storagePath = STORAGE_PATH;
    
    try {
        await fsp.mkdir(storagePath, { recursive: true });
        
        try {
            await fsp.unlink(uidIndexPath);
            process.stderr.write('Deleted existing uid.index.\n');
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
            process.stderr.write('uid.index not found, creating a new one.\n');
        }

        const uids = new Set();
        
        async function findMailFiles(dirPath) {
            try {
                const entries = await fsp.readdir(dirPath, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dirPath, entry.name);
                    if (entry.isDirectory()) {
                        await findMailFiles(fullPath);
                    } else if (entry.isFile() && (entry.name.endsWith('.eml') || entry.name.endsWith('.md'))) {
                        const match = entry.name.match(/^(\d+)_/);
                        if (match && match[1]) {
                            uids.add(match[1]);
                        }
                    }
                }
            } catch (error) {
                if (error.code === 'ENOENT') {
                    process.stderr.write(`Directory not found: ${dirPath}, skipping scan.\n`);
                    return;
                }
                throw error;
            }
        }

        await findMailFiles(storagePath);

        const uidArray = Array.from(uids);
        await fsp.writeFile(uidIndexPath, uidArray.join('\n') + '\n');
        
        process.stderr.write(`Rebuilt uid.index with ${uidArray.length} entries.\n`);

    } catch (error) {
        process.stderr.write(`FATAL: Error rebuilding UID index: ${error.message}\n`);
        throw error;
    }
}

function getDownloadedUids() {
    if (!fs.existsSync(uidIndexPath)) {
        return new Set();
    }
    const content = fs.readFileSync(uidIndexPath, 'utf-8');
    return new Set(content.split('\n').filter(uid => uid));
}

function addDownloadedUid(uid) {
    fs.appendFileSync(uidIndexPath, `${uid}\n`);
}

async function deleteLocalFilesByUids(uidsToDelete) {
    if (uidsToDelete.size === 0) {
        process.stderr.write('No local emails to delete.\n');
        return;
    }
    process.stderr.write(`Starting deletion of ${uidsToDelete.size} emails...\n`);
    const storagePath = STORAGE_PATH;

    async function findAndDelete(dirPath) {
        try {
            const entries = await fsp.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    await findAndDelete(fullPath);
                } else if (entry.isFile()) {
                    const match = entry.name.match(/^(\d+)_/);
                    if (match && match[1] && uidsToDelete.has(match[1])) {
                        try {
                            await fsp.unlink(fullPath);
                            process.stderr.write(`Deleted ${entry.name}\n`);
                        } catch (delError) {
                            process.stderr.write(`Failed to delete ${entry.name}: ${delError.message}\n`);
                        }
                    }
                }
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                process.stderr.write(`Error scanning directory for deletion ${dirPath}: ${error.message}\n`);
            }
        }
    }
    await findAndDelete(storagePath);
}


async function convertFile(filePath) {
  try {
    const emlContent = await fsp.readFile(filePath);
    const mail = await simpleParser(emlContent);

    const from = mail.from?.value[0]?.address || 'unknown';
    const subject = mail.subject || '';
    const date = mail.date || new Date();

    const turndownService = new TurndownService();
    const markdownBody = turndownService.turndown(mail.html || mail.textAsHtml || '');

    const frontMatter = `---
From: ${from}
Subject: ${subject}
Date: ${date.toISOString()}
---

`;
    const mdContent = frontMatter + markdownBody;
    const mdFilePath = filePath.replace(/\.eml$/, '.md');

    await fsp.writeFile(mdFilePath, mdContent);
    await fsp.unlink(filePath);
    process.stderr.write(`Converted ${path.basename(filePath)} to ${path.basename(mdFilePath)}\n`);
  } catch (error) {
    process.stderr.write(`Failed to process ${filePath}: ${error.message}\n`);
  }
}

async function findAndConvert(dirPath) {
  try {
    const entries = await fsp.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            await findAndConvert(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.eml')) {
            await convertFile(fullPath);
        }
    }
  } catch (error) {
      if (error.code !== 'ENOENT') {
          throw error;
      }
      // Ignore ENOENT, as the directory might not exist on first run
  }
}

async function preflightCheck() {
    const { host, port, user, proxy } = imapConfig;
    process.stderr.write(`--- Preflight Check ---\n`);
    process.stderr.write(`User: ${user}\n`);
    process.stderr.write(`Host: ${host}\n`);
    process.stderr.write(`Port: ${port}\n`);
    process.stderr.write(`TLS: ${imapConfig.tls}\n`);
    process.stderr.write(`Proxy Enabled: ${proxy.enabled}\n`);
    if (proxy.enabled) {
        process.stderr.write(`Proxy URL: ${proxy.url}\n`);
    }

    if (!host || !port || !user) {
        throw new Error('IMAP host, port, or user is not configured. Check your .env file.');
    }

    if (proxy.enabled) {
        if (!proxy.url) {
            throw new Error('IMAP proxy is enabled, but IMAP_PROXY_URL is not set.');
        }
        try {
            new URL(proxy.url);
            process.stderr.write(`Proxy URL validated: ${proxy.url}\n`);
        } catch (error) {
            throw new Error(`Proxy validation failed: ${error.message}`);
        }
    } else {
        return new Promise((resolve, reject) => {
            if (host === '127.0.0.1' || host === 'localhost') {
                process.stderr.write(`Warning: Connecting to localhost. Inside a container, this usually means the container itself.\n`);
            }
            const socket = new net.Socket();
            socket.setTimeout(5000);
            socket.on('connect', () => {
                process.stderr.write('Direct TCP connection to IMAP server successful.\n');
                socket.end();
                resolve();
            });
            socket.on('error', (err) => reject(new Error(`Preflight check failed: Could not connect to ${host}:${port}. Reason: ${err.code}`)));
            socket.on('timeout', () => {
                socket.destroy();
                reject(new Error(`Preflight check failed: Connection to ${host}:${port} timed out.`));
            });
            socket.connect(port, host);
        });
    }
}

async function fetchAndSave() {
    const client = new ImapFlow({
        host: imapConfig.host,
        port: imapConfig.port,
        secure: imapConfig.tls || imapConfig.port === 993,
        servername: imapConfig.host,
        auth: {
            user: imapConfig.user,
            pass: imapConfig.password
        },
        proxy: imapConfig.proxy.enabled ? imapConfig.proxy.url : undefined,
        tls: {
            rejectUnauthorized: imapConfig.proxy.rejectUnauthorized
        },
        logger: false,
        connectionTimeout: imapConfig.proxy.timeout || 90000
    });

    let lock;

    try {
        await client.connect();
        process.stderr.write('IMAP connection ready. Opening INBOX...\n');
        lock = await client.getMailboxLock('INBOX');

        const whitelist = (process.env.WHITELIST || '')
            .split(',')
            .map(email => email.trim())
            .filter(Boolean);

        if (!whitelist.length) {
            process.stderr.write('Whitelist is empty, skipping fetch.\n');
            return;
        }

        const timeLimitDays = parseInt(process.env.TIME_LIMIT_DAYS, 10) || 30;
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - timeLimitDays);

        process.stderr.write(`Search SINCE date: ${sinceDate.toUTCString()}\n`);

        const searchPromises = whitelist.map(async sender => {
            const uids = await client.search({ since: sinceDate, from: sender }, { uid: true });
            process.stderr.write(`Sender ${sender} -> ${uids.length} matches\n`);
            return uids;
        });

        const resultsBySender = await Promise.all(searchPromises);
        const remoteUids = new Set(resultsBySender.flat().map(String));
        process.stderr.write(`Found ${remoteUids.size} total emails on server matching criteria.\n`);

        const localUids = getDownloadedUids();
        process.stderr.write(`Found ${localUids.size} emails in local store.\n`);

        const uidsToDelete = new Set([...localUids].filter(uid => !remoteUids.has(uid)));
        const uidsToFetch = new Set([...remoteUids].filter(uid => !localUids.has(uid)));

        await deleteLocalFilesByUids(uidsToDelete);

        const uidsToFetchArray = Array.from(uidsToFetch);
        if (uidsToFetchArray.length === 0) {
            process.stderr.write('No new mail to download.\n');
            return;
        }

        process.stderr.write(`Found ${uidsToFetchArray.length} new emails to download.\n`);

        const messages = await client.fetchAll(
            uidsToFetchArray,
            { uid: true, envelope: true, source: true },
            { uid: true }
        );

        async function saveEmail({ uid, body, envelope }) {
            const storagePath = STORAGE_PATH;
            let sender = envelope?.from?.[0]?.address || 'unknown';

            if (!sender || sender === 'unknown') {
                try {
                    const mail = await simpleParser(body);
                    sender = mail.from?.value?.[0]?.address || mail.from?.text || 'unknown';
                } catch (parseError) {
                    process.stderr.write(`Failed to parse sender for UID ${uid}: ${parseError.message}\n`);
                }
            }

            const senderDir = path.join(storagePath, sender.replace(/[^a-zA-Z0-9.-]/g, '_'));
            if (!fs.existsSync(senderDir)) fs.mkdirSync(senderDir, { recursive: true });

            const filename = path.join(senderDir, `${uid}_${Date.now()}.eml`);
            fs.writeFileSync(filename, body);
            addDownloadedUid(uid);
            process.stderr.write(`Saved to ${path.basename(filename)}\n`);
        }

        for (const message of messages) {
            const source = Buffer.isBuffer(message.source)
                ? message.source.toString('utf8')
                : String(message.source || '');
            if (message.uid && source) {
                await saveEmail({ uid: message.uid, body: source, envelope: message.envelope });
            }
        }

        process.stderr.write('Done fetching all messages!\n');
    } finally {
        if (lock) {
            lock.release();
        }
        try {
            await client.logout();
        } catch (logoutError) {
            client.close();
        }
        process.stderr.write('IMAP connection ended.\n');
    }
}

async function findMdFiles(dirPath) {
    let mdFiles = [];
    try {
        const entries = await fsp.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                mdFiles = mdFiles.concat(await findMdFiles(fullPath));
            } else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'vcp_index.md') {
                mdFiles.push(fullPath);
            }
        }
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
    return mdFiles;
}

async function getIndex() {
    const storagePath = STORAGE_PATH;
    const allMdFiles = await findMdFiles(storagePath);

    if (allMdFiles.length === 0) {
        return "No mail found in the local store.";
    }

    allMdFiles.sort();

    let combinedContent = "--- START OF LOCAL MAIL INDEX ---\n\n";
    for (const filePath of allMdFiles) {
        try {
            const content = await fsp.readFile(filePath, 'utf-8');
            const fileName = path.basename(filePath);
            combinedContent += `--- MAIL: ${fileName} ---\n`;
            combinedContent += content;
            combinedContent += `\n\n--- END OF MAIL: ${fileName} ---\n\n`;
        } catch (error) {
            process.stderr.write(`Could not read file ${filePath}: ${error.message}\n`);
        }
    }
    combinedContent += "--- END OF LOCAL MAIL INDEX ---";
    return combinedContent;
}

async function main() {
    try {
        process.stderr.write('--- Starting IMAPIndex Plugin Execution ---\n');
        
        await preflightCheck();

        process.stderr.write('Step 1: Rebuilding UID index from local file store...\n');
        await rebuildUidIndex();

        process.stderr.write('Step 2: Syncing emails with IMAP server...\n');
        await fetchAndSave();
        
        const storagePath = STORAGE_PATH;
        process.stderr.write('Step 3: Converting EML files to Markdown...\n');
        await findAndConvert(storagePath);

        process.stderr.write('Step 4: Generating combined index...\n');
        const indexContent = await getIndex();
        
        process.stderr.write('Step 5: Outputting index and writing to cache...\n');
        process.stdout.write(indexContent);
        
        const cacheFilePath = path.join(storagePath, 'vcp_index.md');
        await fsp.writeFile(cacheFilePath, indexContent);

        process.stderr.write('--- IMAPIndex Plugin Execution Finished Successfully ---\n');

        // Run any post-execution scripts if defined
        await runPostScripts();

    } catch (error) {
        const errorMessage = `Failed during IMAPIndex execution: ${error.message}`;
        process.stderr.write(errorMessage + '\n');
        process.stdout.write(errorMessage);
        process.exit(1);
    }
}

main();
