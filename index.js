const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const fs = require("fs");

let data = {
    in: 0,
    out: 0
};

if (fs.existsSync("data.json")) {
    data = JSON.parse(fs.readFileSync("data.json", "utf8"));
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

        const { connection, lastDisconnect } = update;

        if (connection === "open") {
            console.log("✅ JB BOT CONNECTED");
        }

        if (connection === "close") {

            const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !==
                DisconnectReason.loggedOut;

            if (shouldReconnect) {
                startBot();
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

        const command = text.trim().split(/\s+/);
        const type = command[0]?.toLowerCase();
        const amount = Number(command[1]);

        let reply = "";

        if (type === ".in") {

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

        else if (type === ".out") {

            if (!amount || amount <= 0) {
                reply = "❌ Contoh: .out 
