import React, { useEffect, useState } from "react";
import io from "socket.io-client";
import SlotGrid from "./components/SlotGrid";

// Create socket connection OUTSIDE component to prevent reconnections
const socket = io("http://localhost:3001", {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});

export default function App() {
  const [slots, setSlots] = useState([]);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    console.log("🔧 Setting up Socket.IO listeners...");

    // Connection status handlers
    socket.on("connect", () => {
      console.log("✅ Socket.IO connected:", socket.id);
      setConnected(true);
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Socket.IO disconnected:", reason);
      setConnected(false);
    });

    socket.on("connect_error", (error) => {
      console.error("❌ Connection error:", error.message);
      setConnected(false);
    });

    // Listen for initial data from socket
    socket.on("initialData", (data) => {
      console.log("📥 Received initialData:", data);
      if (Array.isArray(data)) {
        setSlots(data);
      }
    });

    // Listen for live updates - THIS IS THE KEY PART
    socket.on("slotUpdate", (data) => {
      console.log("🔄 Received slotUpdate:", data);
      setLastUpdate(new Date().toLocaleTimeString());
      
      setSlots(prev => {
        console.log("📊 Previous slots:", prev);
        const exists = prev.find(s => s.slot_id === data.slot_id);
        
        let updated;
        if (exists) {
          // Update existing slot
          updated = prev.map(s => 
            s.slot_id === data.slot_id ? { ...s, ...data } : s
          );
        } else {
          // Add new slot
          updated = [...prev, data].sort((a, b) => a.slot_id - b.slot_id);
        }
        
        console.log("📊 Updated slots:", updated);
        return updated;
      });
    });

    // Fallback: Also fetch via REST API on mount
    fetch("http://localhost:3001/api/slots")
      .then(res => res.json())
      .then(data => {
        console.log("📥 Fallback: Initial slots from REST API:", data);
        if (slots.length === 0) {
          setSlots(data);
        }
      })
      .catch(err => console.error("❌ Error fetching slots:", err));

    // Cleanup function
    return () => { 
      console.log("🧹 Cleaning up Socket.IO listeners");
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("initialData");
      socket.off("slotUpdate");
    };
  }, []); // Empty dependency array - only run once

  return (
    <div style={{
      padding: "20px",
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      backgroundColor: "#f0f4f8",
      minHeight: "100vh"
    }}>
      <header style={{
        textAlign: "center",
        marginBottom: "30px"
      }}>
        <h1 style={{ color: "#1e3a8a" }}>Parking System Assistance</h1>
        <p style={{ color: "#555" }}>Real-time parking slot monitoring</p>
        <div style={{ 
          fontSize: "14px", 
          fontWeight: "500",
          display: "flex",
          justifyContent: "center",
          gap: "20px",
          flexWrap: "wrap"
        }}>
          <span style={{ color: connected ? "#10b981" : "#ef4444" }}>
            {connected ? "🟢" : "🔴"} Socket: {connected ? "Connected" : "Disconnected"}
          </span>
          <span style={{ color: "#6366f1" }}>
            📊 Slots: {slots.length}
          </span>
          {lastUpdate && (
            <span style={{ color: "#8b5cf6" }}>
              🕐 Last Update: {lastUpdate}
            </span>
          )}
        </div>
      </header>

      {slots.length === 0 && (
        <div style={{
          textAlign: "center",
          padding: "40px",
          backgroundColor: "#fff",
          borderRadius: "8px",
          marginBottom: "20px"
        }}>
          <p style={{ color: "#6b7280" }}>
            Waiting for slot data... {connected ? "Connected" : "Connecting..."}
          </p>
        </div>
      )}

      <SlotGrid slots={slots} />

      {/* Debug panel - remove in production */}
      <div style={{
        marginTop: "20px",
        padding: "15px",
        backgroundColor: "#1f2937",
        color: "#e5e7eb",
        borderRadius: "8px",
        fontSize: "12px",
        fontFamily: "monospace"
      }}>
        <strong>Debug Info:</strong>
        <pre style={{ margin: "10px 0 0 0", overflowX: "auto" }}>
          {JSON.stringify({ 
            connected, 
            socketId: socket.id,
            slotsCount: slots.length,
            slots: slots 
          }, null, 2)}
        </pre>
      </div>
    </div>
  );
}