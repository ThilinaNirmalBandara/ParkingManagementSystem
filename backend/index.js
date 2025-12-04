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
  origin: ["http://localhost:3000", "http://localhost:5173"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, { 
  cors: { 
    origin: ["http://localhost:3000", "http://localhost:5173"],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

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

  // Socket.IO - Set this up BEFORE MQTT
  io.on("connection", async (socket) => {
    console.log("✅ Client connected:", socket.id);
    
    // Send initial data when client connects
    try {
      const slots = await slotsCol.find().sort({ slot_id: 1 }).toArray();
      socket.emit("initialData", slots);
      console.log("📤 Sent initial data to client:", socket.id);
    } catch (err) {
      console.error("❌ Error sending initial data:", err);
    }

    socket.on("disconnect", () => {
      console.log("❌ Client disconnected:", socket.id);
    });
  });

  // MQTT
  const client = mqtt.connect(MQTT_BROKER, { family: 4 });

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
    console.log("📨 MQTT message received:", topic, message.toString());
    try {
      const data = JSON.parse(message.toString());
      console.log("✅ JSON parsed:", data);
      
      // Update MongoDB
      await slotsCol.updateOne(
        { slot_id: data.slot_id }, 
        { $set: data }, 
        { upsert: true }
      );
      
      // Emit to ALL connected Socket.IO clients
      const connectedClients = io.engine.clientsCount;
      console.log(`📤 Emitting to ${connectedClients} connected clients`);
      io.emit("slotUpdate", data);
      console.log("✅ Emitted slotUpdate:", data);
      
    } catch (err) {
      console.error("❌ Error processing MQTT message:", err);
    }
  });

  // REST API
  app.get("/api/slots", async (req, res) => {
    try {
      const slots = await slotsCol.find().sort({ slot_id: 1 }).toArray();
      res.json(slots);
    } catch (err) {
      console.error("❌ Error fetching slots:", err);
      res.status(500).json({ error: "Failed to fetch slots" });
    }
  });
  
  // 🆕 Update slot status from frontend
  app.put("/api/slots/:id/status", async (req, res) => {
    try {
      const slotId = parseInt(req.params.id, 10);
      const { status } = req.body;

      if (!["free", "occupied", "reserved"].includes(status?.toLowerCase())) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const update = {
        $set: {
          slot_id: slotId,
          status: status.toLowerCase(),
          updated_by: "frontend",
          updated_at: new Date()
        }
      };

      const result = await slotsCol.updateOne(
        { slot_id: slotId },
        update,
        { upsert: true }
      );

      // Read back the full document to emit
      const updatedDoc = await slotsCol.findOne({ slot_id: slotId });

      // Emit to all Socket.IO clients so they update in real time
      io.emit("slotUpdate", updatedDoc);

      console.log(`✅ Slot ${slotId} status updated from frontend →`, updatedDoc);

      res.json(updatedDoc);
    } catch (err) {
      console.error("❌ Error updating slot status:", err);
      res.status(500).json({ error: "Failed to update slot status" });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      mqtt: client.connected,
      socketClients: io.engine.clientsCount
    });
  });

  server.listen(PORT, () => {
    console.log(`🚀 Backend running → http://localhost:${PORT}`);
    console.log(`🔌 Socket.IO ready for connections`);
  });
})();