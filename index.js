const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const fs = require("fs");
const http = require("http");
const qrcode = require("qrcode-terminal");

// Server untuk Render
const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
    res.writeHead(200);
    res.end("JB BOT is running!");
}).listen(PORT, () => {
    console.log(`🌐 Server running on port ${PORT}`);
});

// Data kewangan
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
        console.log("Data lama gagal dibaca.");
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

async function startBot() {

    const { state, saveCreds } =
        await useMultiFileAuthState("auth_info");

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: "silent" })
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {

        const {
            connection,
            lastDisconnect,
            qr
        } = update;

        if (qr) {
            console.log("📱 SCAN QR INI DENGAN WHATSAPP:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === "open") {
            console.log("✅ JB BOT CONNECTED!");
        }

        if (connection === "close") {

            const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !==
                DisconnectReason.loggedOut;

            if (shouldReconnect) {
                console.log("🔄 Reconnecting...");
                startBot();
            } else {
                console.log("❌ WhatsApp logged out.");
            }
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {

        const msg = messages[0];

        if (!msg.message) return;
        if (msg.key.fromMe) return;

        const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            "";

        const parts = text.trim().split(/\s+/);

        const command = parts[0]?.toLowerCase();
        const amount = Number(parts[1]);

        let reply = "";

        if (command === ".in") {

            if (!amount || amount <= 0) {
                reply = "❌ Contoh: .in 150";
            } else {

                data.in += amount;
                saveData();

                reply =
                    `✅ IN +${money(amount)}\n\n` +
                    `💰 Total IN: ${money(data.in)}`;
            }
        }

        else if (command === ".out") {

            if (!amount || amount <= 0) {
                reply = "❌ Contoh: .out 50";
            } else {

                data.out += amount;
                saveData();

                reply =
                    `✅ OUT -${money(amount)}\n\n` +
                    `💸 Total OUT: ${money(data.out)}`;
            }
        }

        else if (command === ".info") {

            const bersih = data.in - data.out;

            reply =
                `📊 *JB INFO*\n\n` +
                `💰 IN     : ${money(data.in)}\n` +
                `💸 OUT    : ${money(data.out)}\n` +
                `📈 BERSIH : ${money(bersih)}`;
        }

        else if (command === ".reset") {

            data.in = 0;
            data.out = 0;

            saveData();

            reply = "♻️ Rekod JB telah di-reset.";
        }

        if (reply) {
            await sock.sendMessage(
                msg.key.remoteJid,
                { text: reply }
            );
        }
    });
}

startBot();
