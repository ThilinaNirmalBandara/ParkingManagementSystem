import React from "react";

export default function SlotGrid({ slots }) {
  // Create array of 21 slots, filling in with data or defaults
  const allSlots = Array.from({ length: 21 }, (_, i) => {
    const slotNumber = i + 1;
    const slotData = slots.find(s => s.slot_id === slotNumber);
    
    return {
      slot_id: slotNumber,
      status: slotData?.status || "free",
      _id: slotData?._id,
      battery_percent: slotData?.battery_percent,
      battery_mv: slotData?.battery_mv,
      rssi_dbm: slotData?.rssi_dbm,
      timestamp: slotData?.timestamp
    };
  });

  const getSlotColor = (status) => {
    switch (status?.toLowerCase()) {
      case "occupied":
        return {
          background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
          border: "#b91c1c",
          text: "#fff"
        };
      case "free":
        return {
          background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
          border: "#047857",
          text: "#fff"
        };
      case "reserved":
        return {
          background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
          border: "#b45309",
          text: "#fff"
        };
      default:
        return {
          background: "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)",
          border: "#374151",
          text: "#fff"
        };
    }
  };

  // Cycle statuses when clicking a slot
  const cycleStatus = (status) => {
    const s = status?.toLowerCase();
    if (s === "free") return "reserved";
    if (s === "reserved") return "occupied";
    return "free"; // from occupied or unknown
  };

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
      gap: "20px",
      maxWidth: "1200px",
      margin: "0 auto"
    }}>
      {allSlots.map((slot) => {
        const colors = getSlotColor(slot.status);
        
        return (
          <div
            key={slot.slot_id}
            style={{
              background: colors.background,
              border: `3px solid ${colors.border}`,
              borderRadius: "12px",
              padding: "20px",
              textAlign: "center",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
              transition: "all 0.3s ease",
              cursor: "pointer",
              position: "relative",
              overflow: "hidden"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-5px)";
              e.currentTarget.style.boxShadow = "0 8px 12px rgba(0, 0, 0, 0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";
            }}
          >
            {/* Animated pulse for occupied slots */}
            {slot.status === "occupied" && (
              <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(255, 255, 255, 0.1)",
                animation: "pulse 2s infinite"
              }} />
            )}
            
            <div style={{
              fontSize: "24px",
              fontWeight: "bold",
              color: colors.text,
              marginBottom: "10px",
              position: "relative",
              zIndex: 1
            }}>
              Slot {slot.slot_id}
            </div>
            
            <div style={{
              fontSize: "16px",
              fontWeight: "600",
              color: colors.text,
              textTransform: "capitalize",
              position: "relative",
              zIndex: 1
            }}>
              {slot.status}
            </div>

            {/* Status icon */}
            <div style={{
              fontSize: "32px",
              marginTop: "10px",
              position: "relative",
              zIndex: 1
            }}>
              {slot.status === "occupied" ? "🚗" : 
               slot.status === "reserved" ? "🔒" : 
               "✓"}
            </div>
            {/* power / signal info */}
            <div style={{
              marginTop: "12px",
              fontSize: "12px",
              color: "#e5e7eb",
              position: "relative",
              zIndex: 1,
              lineHeight: 1.4
            }}>
              <div>
                🔋 Battery: {slot.battery_percent != null ? `${slot.battery_percent}%` : "N/A"}
              </div>
              <div>
                📶 RSSI: {slot.rssi_dbm != null ? `${slot.rssi_dbm} dBm` : "N/A"}
              </div>
            </div>
          </div>
        );
      })}

      {/* Add CSS animation */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 0;
            }
            50% {
              opacity: 1;
            }
          }
        `}
      </style>
    </div>
  );
}