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
        data = JSON.parse(
            fs.readFileSync("data.json", "utf8")
        );
    } catch (error) {
        console.log("❌ Data lama gagal dibaca.");
    }
}

function saveData() {
    fs.writeFileSync(
        "data.json",
        JSON.stringify(data, null, 2)
    );
}

function money(value) {
    return `RM${value.toFixed(2)}`;
}

// =========================
// START BOT
// =========================

async function startBot() {

    const { state, saveCreds } =
        await useMultiFileAuthState("auth_info");

    const sock = makeWASocket({
        auth: state,
        logger: pino({
            level: "silent"
        })
    });

    // Simpan credentials
    sock.ev.on("creds.update", saveCreds);

    // =========================
    // PAIRING CODE
    // =========================

    if (!state.creds.registered) {

        const phoneNumber = process.env.PHONE_NUMBER;

        if (phoneNumber) {

            setTimeout(async () => {

                try {

                    const code =
                        await sock.requestPairingCode(
                            phoneNumber
                        );

                    console.log(
                        "🔐 PAIRING CODE:",
                        code
                    );

                } catch (error) {

                    console.log(
                        "❌ Pairing error:",
                        error.message
                    );

                }

            }, 3000);

        } else {

            console.log(
                "❌ PHONE_NUMBER belum diset."
            );

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

            if (connection === "open") {

                console.log(
                    "✅ JB BOT CONNECTED!"
                );

            }

            if (connection === "close") {

                const shouldReconnect =
                    lastDisconnect?.error
                        ?.output?.statusCode !==
                    DisconnectReason.loggedOut;

                if (shouldReconnect) {

                    console.log(
                        "🔄 Reconnecting..."
                    );

                    startBot();

                } else {

                    console.log(
                        "❌ WhatsApp logged out."
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
        async ({ messages }) => {

            try {

                const msg = messages[0];

                if (!msg) return;

                if (!msg.message) return;

                if (msg.key.fromMe) return;

                const text =
                    msg.message.conversation ||
                    msg.message
                        .extendedTextMessage?.text ||
                    "";

                const parts =
                    text.trim().split(/\s+/);

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
                        !amount ||
                        amount <= 0
                    ) {

                        reply =
                            "❌ Contoh: .in 150";

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
                        !amount ||
                        amount <= 0
                    ) {

                        reply =
                            "❌ Contoh: .out 50";

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
                        "♻️ Rekod JB telah di-reset.";
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
                }

            } catch (error) {

                console.log(
                    "❌ Message error:",
                    error.message
                );

            }
        }
    );
}

// =========================
// RUN BOT
// =========================

startBot().catch((error) => {

    console.log(
        "❌ Bot error:",
        error.message
    );

});
