import express from "express";
import cors from "cors";
import http from "http";
import mqtt from "mqtt";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://136.112.175.183:3000"   // frontend on VM
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, { 
  cors: { 
    origin: [
      "http://localhost:3000",
      "http://localhost:5173",
      "http://136.112.175.183:3000"
    ],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ["websocket", "polling"]
});

// ---- Config ----
const MQTT_BROKER   = process.env.MQTT_BROKER   || "mqtt://127.0.0.1:1883";
const MQTT_USERNAME = process.env.MQTT_USERNAME || "parking_admin";
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || "Password123";

const MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017";
const DB_NAME   = "parkingdb";
const PORT      = process.env.PORT || 3001;

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-change-me";

// Simple hard-coded admin user (for demo)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@123";

// ---- Middleware: requireAdmin ----
function requireAdmin(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }

    const token = auth.slice(7); // remove "Bearer "
    const payload = jwt.verify(token, JWT_SECRET); // throws if invalid/expired

    // Optionally check role here if you add it later
    req.user = payload;
    next();
  } catch (err) {
    console.error("❌ Auth error:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ---- Login Route (issues JWT) ----
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body || {};

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { username, role: "admin" },
    JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({ token });
});

// ---- Main async bootstrap ----
(async () => {
  // MongoDB
  const mongo = new MongoClient(MONGO_URL);
  await mongo.connect();
  const db = mongo.db(DB_NAME);
  const slotsCol = db.collection("slots");

  // Socket.IO
  io.on("connection", async (socket) => {
    console.log("✅ Client connected:", socket.id);
    
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

  // MQTT (with username/password)
  const client = mqtt.connect(MQTT_BROKER, { 
    family: 4,
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD
  });

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
      
      await slotsCol.updateOne(
        { slot_id: data.slot_id }, 
        { $set: data }, 
        { upsert: true }
      );
      
      const connectedClients = io.engine.clientsCount;
      console.log(`📤 Emitting to ${connectedClients} connected clients`);
      io.emit("slotUpdate", data);
      console.log("✅ Emitted slotUpdate:", data);
      
    } catch (err) {
      console.error("❌ Error processing MQTT message:", err);
    }
  });

  // ---- REST API ----
  app.get("/api/slots", async (req, res) => {
    try {
      const slots = await slotsCol.find().sort({ slot_id: 1 }).toArray();
      res.json(slots);
    } catch (err) {
      console.error("❌ Error fetching slots:", err);
      res.status(500).json({ error: "Failed to fetch slots" });
    }
  });
  
  // 🔒 Update slot status – protected by requireAdmin
  app.put("/api/slots/:id/status", requireAdmin, async (req, res) => {
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
          updated_by: req.user?.username || "frontend",
          updated_at: new Date()
        }
      };

      await slotsCol.updateOne(
        { slot_id: slotId },
        update,
        { upsert: true }
      );

      const updatedDoc = await slotsCol.findOne({ slot_id: slotId });

      io.emit("slotUpdate", updatedDoc);

      console.log(`✅ Slot ${slotId} status updated from frontend →`, updatedDoc);

      res.json(updatedDoc);
    } catch (err) {
      console.error("❌ Error updating slot status:", err);
      res.status(500).json({ error: "Failed to update slot status" });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      mqtt: client.connected,
      socketClients: io.engine.clientsCount
    });
  });

  server.listen(PORT, () => {
    console.log(`🚀 Backend running → http://0.0.0.0:${PORT}`);
    console.log(`🔌 Socket.IO ready for connections`);
  });
})();
