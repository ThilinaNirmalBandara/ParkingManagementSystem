import React, { useEffect, useState } from "react";
import io from "socket.io-client";
import SlotGrid from "./components/SlotGrid";

const socket = io("http://127.0.0.1:3001");

export default function App() {
  const [slots, setSlots] = useState([]);

  useEffect(() => {
    // Fetch initial slots
    fetch("http://127.0.0.1:3001/api/slots")
      .then(res => res.json())
      .then(setSlots);

    // Listen for live updates
    socket.on("slotUpdate", (data) => {
      setSlots(prev => {
        const exists = prev.find(s => s.slot_id === data.slot_id);
        if (exists) {
          return prev.map(s => s.slot_id === data.slot_id ? data : s);
        } else {
          return [...prev, data].sort((a, b) => a.slot_id - b.slot_id);
        }
      });
    });

    return () => { socket.off("slotUpdate"); };
  }, []);

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
      </header>

      <SlotGrid slots={slots} />
    </div>
  );
}
