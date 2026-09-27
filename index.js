const fs = require("fs");

let data = {
  in: 0,
  out: 0
};

function loadData() {
  try {
    if (fs.existsSync("data.json")) {
      data = JSON.parse(fs.readFileSync("data.json", "utf8"));
    }
  } catch (error) {
    console.log("Gagal baca data.");
  }
}

function saveData() {
  fs.writeFileSync("data.json", JSON.stringify(data, null, 2));
}

function processCommand(message) {
  const parts = message.trim().split(/\s+/);
  const command = parts[0].toLowerCase();
  const amount = Number(parts[1]);
  
  if (command === ".in") {
    if (!amount || amount <= 0) {
      return "❌ Contoh: .in 150";
    }
    
    data.in += amount;
    saveData();
    
    return `✅ IN +RM${amount.toFixed(2)}`;
  }
  
  if (command === ".out") {
    if (!amount || amount <= 0) {
      return "❌ Contoh: .out 50";
    }
    
    data.out += amount;
    saveData();
    
    return `✅ OUT -RM${amount.toFixed(2)}`;
  }
  
  if (command === ".info") {
    const net = data.in - data.out;
    
    return `📊 JB INFO

💰 IN     : RM${data.in.toFixed(2)}
💸 OUT    : RM${data.out.toFixed(2)}
📈 BERSIH : RM${net.toFixed(2)}`;
  }
  
  if (command === ".reset") {
    data.in = 0;
    data.out = 0;
    saveData();
    
    return "♻️ Semua rekod kewangan telah di-reset.";
  }
  
  return null;
}

loadData();

console.log("JB BOT SYSTEM READY");

console.log(processCommand(".in 150"));
console.log(processCommand(".out 50"));
console.log(processCommand(".info"));