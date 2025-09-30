import express from "express";
import cors from "cors";
import http from "http";
import mqtt from "mqtt";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import { Server } from "socket.io";

dotenv.config();

const app = express();
app.use(cors({
  origin: "http://localhost:3000", // frontend origin
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const MQTT_BROKER = process.env.MQTT_BROKER || "mqtt://127.0.0.1:1883";
const MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017";
const DB_NAME = "parkingdb";
const PORT = process.env.PORT || 3001;

(async () => {
  // MongoDB
  const mongo = new MongoClient(MONGO_URL);
  await mongo.connect();
  const db = mongo.db(DB_NAME);
  const slotsCol = db.collection("slots");

  // MQTT
  const client = mqtt.connect("mqtt://127.0.0.1:1883", { family: 4 });

 client.on("connect", () => {
  console.log("✅ MQTT connected to broker");
  client.subscribe("parking/slot/+/telemetry", (err) => {
    if (err) console.error("❌ MQTT subscribe error:", err);
    else console.log("✅ Subscribed to parking/slot/+/telemetry");
  });
});

  client.on("error", (err) => console.error("❌ MQTT connection error:", err.message));
  client.on("offline", () => console.log("⚠️ MQTT offline"));
  client.on("reconnect", () => console.log("🔄 MQTT trying to reconnect..."));

  client.on("message", async (topic, message) => {
  console.log("📨 MQTT message received:", topic, message.toString()); // first see raw message
  try {
    const data = JSON.parse(message.toString());
    console.log("✅ JSON parsed:", data);
    await slotsCol.updateOne({ slot_id: data.slot_id }, { $set: data }, { upsert: true });
    io.emit("slotUpdate", data);
  } catch (err) {
    console.error("❌ JSON parse error:", err);
  }
});


  // REST API
  app.get("/api/slots", async (req, res) => {
    const slots = await slotsCol.find().sort({ slot_id: 1 }).toArray();
    res.json(slots);
  });

  // Socket.IO
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    socket.on("disconnect", () => console.log("Client disconnected"));
  });

  server.listen(PORT, () =>
    console.log(`Backend → http://localhost:${PORT}`)
  );
})();
