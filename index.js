const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const fs = require("fs");
const http = require("http");

// =========================
// RENDER WEB SERVER
// =========================

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/plain"
    });

    res.end("JB BOT is running!");
}).listen(PORT, () => {
    console.log(`🌐 Server running on port ${PORT}`);
});

// =========================
// DATA KEWANGAN
// =========================

let data = {
    in: 0,
    out: 0
};

if (fs.existsSync("data.json")) {
    try {
        const savedData = JSON.parse(
            fs.readFileSync("data.json", "utf8")
        );

        data.in = Number(savedData.in) || 0;
        data.out = Number(savedData.out) || 0;

    } catch (error) {
        console.log("❌ Data lama gagal dibaca.");
    }
}

function saveData() {
    try {
        fs.writeFileSync(
            "data.json",
            JSON.stringify(data, null, 2)
        );
    } catch (error) {
        console.log("❌ Gagal simpan data:", error.message);
    }
}

function money(value) {
    return `RM${Number(value).toFixed(2)}`;
}

// =========================
// BOT STATE
// =========================

let botStarting = false;

// =========================
// START BOT
// =========================

async function startBot() {

    if (botStarting) {
        return;
    }

    botStarting = true;

    try {

        // =========================
        // AUTH SESSION
        // =========================

        const {
            state,
            saveCreds
        } = await useMultiFileAuthState("auth_info_v2");

        const sock = makeWASocket({
            auth: state,

            logger: pino({
                level: "silent"
            }),

            markOnlineOnConnect: false,

            syncFullHistory: false
        });

        // =========================
        // SAVE CREDENTIALS
        // =========================

        sock.ev.on(
            "creds.update",
            saveCreds
        );

        // =========================
        // PAIRING CODE
        // =========================

        if (!state.creds.registered) {

            const phoneNumber =
                process.env.PHONE_NUMBER;

            if (!phoneNumber) {

                console.log(
                    "❌ PHONE_NUMBER belum diset di Render."
                );

            } else {

                setTimeout(async () => {

                    try {

                        console.log(
                            "🔐 Meminta pairing code..."
                        );

                        const code =
                            await sock.requestPairingCode(
                                phoneNumber
                            );

                        console.log(
                            "🔐 PAIRING CODE:",
                            code
                        );

                        console.log(
                            "📱 Masukkan code tersebut di WhatsApp > Linked Devices."
                        );

                    } catch (error) {

                        console.log(
                            "❌ Pairing error:",
                            error.message
                        );

                    }

                }, 5000);
            }
        }

        // =========================
        // CONNECTION
        // =========================

        sock.ev.on(
            "connection.update",
            async (update) => {

                const {
                    connection,
                    lastDisconnect
                } = update;

                // =========================
                // CONNECTED
                // =========================

                if (connection === "open") {

                    botStarting = false;

                    console.log(
                        "================================"
                    );

                    console.log(
                        "✅ JB BOT CONNECTED!"
                    );

                    console.log(
                        "📱 Bot sudah bersedia menerima command."
                    );

                    console.log(
                        "================================"
                    );
                }

                // =========================
                // DISCONNECTED
                // =========================

                if (connection === "close") {

                    botStarting = false;

                    const statusCode =
                        lastDisconnect
                            ?.error
                            ?.output
                            ?.statusCode;

                    console.log(
                        "❌ Connection closed."
                    );

                    console.log(
                        "Status:",
                        statusCode
                    );

                    // Kalau bukan logout,
                    // cuba connect semula
                    if (
                        statusCode !==
                        DisconnectReason.loggedOut
                    ) {

                        console.log(
                            "🔄 Cuba reconnect dalam 5 saat..."
                        );

                        setTimeout(() => {

                            startBot();

                        }, 5000);

                    } else {

                        console.log(
                            "❌ WhatsApp telah logout."
                        );

                        console.log(
                            "⚠️ Pair semula diperlukan."
                        );
                    }
                }
            }
        );

        // =========================
        // MESSAGE HANDLER
        // =========================

        sock.ev.on(
            "messages.upsert",
            async ({ messages, type }) => {

                try {

                    // Abaikan history lama
                    if (type !== "notify") {
                        return;
                    }

                    for (const msg of messages) {

                        if (!msg) {
                            continue;
                        }

                        // Tiada message
                        if (!msg.message) {
                            continue;
                        }

                        // Abaikan mesej daripada bot sendiri
                        if (msg.key.fromMe) {
                            continue;
                        }

                        // =========================
                        // AMBIL TEXT
                        // =========================

                        const text =
                            msg.message.conversation ||
                            msg.message.extendedTextMessage?.text ||
                            msg.message.ephemeralMessage?.message?.conversation ||
                            msg.message.ephemeralMessage?.message?.extendedTextMessage?.text ||
                            "";

                        const cleanText =
                            text.trim();

                        if (!cleanText) {
                            continue;
                        }

                        console.log(
                            `📩 Message: ${cleanText}`
                        );

                        // =========================
                        // SPLIT COMMAND
                        // =========================

                        const parts =
                            cleanText.split(/\s+/);

                        const command =
                            parts[0]?.toLowerCase();

                        const amount =
                            Number(parts[1]);

                        let reply = "";

                        // =========================
                        // .IN
                        // =========================

                        if (command === ".in") {

                            if (
                                !Number.isFinite(amount) ||
                                amount <= 0
                            ) {

                                reply =
                                    "❌ Format salah.\n\n" +
                                    "Contoh:\n" +
                                    ".in 150";

                            } else {

                                data.in += amount;

                                saveData();

                                reply =
                                    `✅ IN +${money(amount)}\n\n` +
                                    `💰 Total IN: ${money(data.in)}`;
                            }
                        }

                        // =========================
                        // .OUT
                        // =========================

                        else if (command === ".out") {

                            if (
                                !Number.isFinite(amount) ||
                                amount <= 0
                            ) {

                                reply =
                                    "❌ Format salah.\n\n" +
                                    "Contoh:\n" +
                                    ".out 50";

                            } else {

                                data.out += amount;

                                saveData();

                                reply =
                                    `✅ OUT -${money(amount)}\n\n` +
                                    `💸 Total OUT: ${money(data.out)}`;
                            }
                        }

                        // =========================
                        // .INFO
                        // =========================

                        else if (command === ".info") {

                            const bersih =
                                data.in - data.out;

                            reply =
                                `📊 *JB INFO*\n\n` +
                                `💰 IN     : ${money(data.in)}\n` +
                                `💸 OUT    : ${money(data.out)}\n` +
                                `📈 BERSIH : ${money(bersih)}`;
                        }

                        // =========================
                        // .RESET
                        // =========================

                        else if (command === ".reset") {

                            data.in = 0;
                            data.out = 0;

                            saveData();

                            reply =
                                "♻️ Rekod JB telah di-reset.\n\n" +
                                "💰 IN: RM0.00\n" +
                                "💸 OUT: RM0.00\n" +
                                "📈 BERSIH: RM0.00";
                        }

                        // =========================
                        // UNKNOWN COMMAND
                        // =========================

                        else if (
                            command === ".help" ||
                            command === ".menu"
                        ) {

                            reply =
                                `🤖 *JB BOT COMMAND*\n\n` +
                                `.in 150\n` +
                                `.out 50\n` +
                                `.info\n` +
                                `.reset`;
                        }

                        // =========================
                        // SEND REPLY
                        // =========================

                        if (reply) {

                            await sock.sendMessage(
                                msg.key.remoteJid,
                                {
                                    text: reply
                                }
                            );

                            console.log(
                                `📤 Reply sent: ${command}`
                            );
                        }
                    }

                } catch (error) {

                    console.log(
                        "❌ Message error:",
                        error.message
                    );
                }
            }
        );

    } catch (error) {

        botStarting = false;

        console.log(
            "❌ Bot start error:",
            error.message
        );

        setTimeout(() => {
            startBot();
        }, 5000);
    }
}

// =========================
// RUN BOT
// =========================

console.log(
    "🚀 Starting JB BOT..."
);

startBot();
