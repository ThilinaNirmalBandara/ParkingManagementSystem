import React, { useEffect, useState } from "react";
import io from "socket.io-client";
import SlotGrid from "./components/SlotGrid";

const BACKEND_URL = "http://136.112.175.183:3001"; 

// Create socket connection OUTSIDE component to prevent reconnections
const socket = io(BACKEND_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});

export default function App() {
  const [slots, setSlots] = useState([]);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  // 🆕 auth state
  const [token, setToken] = useState(null);
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    // 🆕 load token from localStorage (persist login)
    const savedToken = localStorage.getItem("adminToken");
    if (savedToken) {
      setToken(savedToken);
    }

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

    // Listen for live updates
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
    fetch(`${BACKEND_URL}/api/slots`)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only run once

  // 🆕 login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");

    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username: loginUser,
          password: loginPass
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("❌ Login failed:", err);
        setLoginError(err.error || "Login failed");
        return;
      }

      const data = await res.json();
      console.log("✅ Login success, token:", data.token);
      setToken(data.token);
      localStorage.setItem("adminToken", data.token);
      setLoginPass("");
      setLoginError("");
    } catch (err) {
      console.error("❌ Login error:", err);
      setLoginError("Network error");
    }
  };

  // 🆕 logout handler
  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem("adminToken");
  };

  // 🔁 Handler: change slot status from frontend (now including auth)
  const handleStatusChange = async (slotId, newStatus) => {
    if (!token) {
      alert("Only admin can change status. Please log in.");
      return;
    }

    try {
      console.log(`📝 Changing slot ${slotId} → ${newStatus}`);

      const res = await fetch(`${BACKEND_URL}/api/slots/${slotId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`    // 🆕 send token
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("❌ Failed to update status:", err);
        alert(err.error || "Failed to update status");
        // If token expired/invalid, log out
        if (res.status === 401 || res.status === 403) {
          handleLogout();
        }
        return;
      }

      const updated = await res.json();
      console.log("✅ Status update saved:", updated);

      // No need to manually update state; backend will emit `slotUpdate`.
    } catch (err) {
      console.error("❌ Error calling status API:", err);
      alert("Error updating status");
    }
  };
  

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
          flexWrap: "wrap",
          marginBottom: "10px"
        }}>
          <span style={{ color: connected ? "#10b981" : "#ef4444" }}>
            {connected ? "🟢" : "🔴"} Socket: {connected ? "Connected" : "Disconnected"}
          </span>
          <span style={{ color: "#6366f1" }}>
            📊 Slots: {(slots.length) - 1}
          </span>
          {lastUpdate && (
            <span style={{ color: "#8b5cf6" }}>
              🕐 Last Update: {lastUpdate}
            </span>
          )}
        </div>

        {/* 🆕 Login / logout panel */}
        <div style={{
          marginTop: "10px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap"
        }}>
          {token ? (
            <>
              <span style={{ color: "#16a34a", fontWeight: 600 }}>
                🔐 Admin mode: ON
              </span>
              <button
                onClick={handleLogout}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#ef4444",
                  color: "#fff",
                  cursor: "pointer"
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <form
              onSubmit={handleLogin}
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
                justifyContent: "center"
              }}
            >
              <input
                type="text"
                placeholder="Admin user"
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                style={{
                  padding: "6px 8px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5f5"
                }}
              />
              <input
                type="password"
                placeholder="Password"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                style={{
                  padding: "6px 8px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5f5"
                }}
              />
              <button
                type="submit"
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#2563eb",
                  color: "#fff",
                  cursor: "pointer"
                }}
              >
                Admin Login
              </button>
            </form>
          )}
        </div>
        {loginError && (
          <div style={{ marginTop: "6px", color: "#dc2626", fontSize: "12px" }}>
            {loginError}
          </div>
        )}
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

      <SlotGrid 
        slots={slots} 
        onChangeStatus={handleStatusChange}
        canEdit={!!token}              // 🆕 pass edit permission
      />

      {/* Debug panel removed for production */}
    </div>
  );
}
