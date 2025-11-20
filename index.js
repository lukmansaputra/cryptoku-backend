import WebSocket from "ws";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

// =============================
// CONFIG
// =============================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Pair yang ingin dimonitor
const PAIRS = ["BTCUSDT", "ETHUSDT", "TONUSDT", "BNBUSDT"];

// Interval simpan ke supabase (ms)
const SAVE_INTERVAL = 15000;

// Menampung harga realtime
const priceStore = {};

// =============================
// CONNECT TO BINANCE WS
// =============================
function startWS() {
  const stream = PAIRS.map((p) => `${p.toLowerCase()}@trade`).join("/");
  const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${stream}`);

  ws.on("open", () => {
    console.log("🔥 Connected to Binance WebSocket");
  });

  ws.on("message", (data) => {
    try {
      const json = JSON.parse(data);
      const symbol = json?.data?.s;
      const price = parseFloat(json?.data?.p);

      if (!symbol || !price) return;

      priceStore[symbol] = price;
    } catch (err) {
      console.error("Error parsing message:", err);
    }
  });

  ws.on("close", () => {
    console.log("⚠️ WS closed. Reconnecting in 3s...");
    setTimeout(startWS, 3000);
  });

  ws.on("error", (err) => {
    console.error("❌ WS error:", err);
    ws.close();
  });
}

startWS();

// =============================
// SAVE TO SUPABASE EVERY 15s
// =============================
async function savePrices() {
  const entries = Object.entries(priceStore);

  if (entries.length === 0) {
    console.log("No price data yet...");
    return;
  }

  const rows = entries.map(([symbol, price]) => ({
    symbol,
    price,
  }));

  const { error } = await supabase.from("prices").insert(rows);

  if (error) {
    console.error("❌ Failed to save prices:", error);
  } else {
    console.log("💾 Saved:", rows);
  }
}

setInterval(savePrices, SAVE_INTERVAL);
console.log("⏳ Saver interval running...");
