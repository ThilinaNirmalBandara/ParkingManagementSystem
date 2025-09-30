import React from "react";
import Slot from "./Slot";

export default function SlotGrid({ slots }) {
  // Assuming we want to show 20 slots as example
  const totalSlots = 20;
  const allSlots = Array.from({ length: totalSlots }, (_, i) => {
    const found = slots.find(s => s.slot_id === i + 1);
    return found || { slot_id: i + 1, status: 0, battery: null, ts: null };
  });

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
      gap: "15px"
    }}>
      {allSlots.map(s => <Slot key={s.slot_id} slot={s} />)}
    </div>
  );
}
