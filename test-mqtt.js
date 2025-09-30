import mqtt from "mqtt";

const client = mqtt.connect("mqtt://127.0.0.1:1883", { family: 4 });

client.on("connect", () => console.log("✅ Connected!"));
client.on("error", (err) => console.error("❌ Error:", err.message));
client.on("offline", () => console.log("⚠️ Offline"));
client.on("reconnect", () => console.log("🔄 Reconnecting..."));
