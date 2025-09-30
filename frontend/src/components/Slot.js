import React from "react";

export default function Slot({ slot }) {
  const isOccupied = slot.status === 1;
  return (
    <div style={{
      padding: "15px",
      borderRadius: "10px",
      textAlign: "center",
      backgroundColor: isOccupied ? "#ef4444" : "#10b981",
      color: "white",
      fontWeight: "bold",
      boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
      transition: "background-color 0.3s"
    }}>
      <div>Slot {slot.slot_id}</div>
      <div>{isOccupied ? "Occupied" : "Free"}</div>
    </div>
  );
}
