import json
import time
from datetime import datetime, timezone

import streamlit as st
import paho.mqtt.client as mqtt

MQTT_HOST = "136.112.175.183"
MQTT_PORT = 1883
MQTT_USER = "parking_admin"
MQTT_PASS = "Password123"

SLOT_ID = 6
FREE_THRESHOLD_CM = 50.0

def decide_status(cm: float) -> str:
    return "free" if cm > FREE_THRESHOLD_CM else "occupied"

def now_time_only_utc() -> str:
    return datetime.now(timezone.utc).strftime("%H:%M:%S")

@st.cache_resource
def get_client():
    c = mqtt.Client(client_id=f"PC_GUI_Slot_{SLOT_ID}")
    c.username_pw_set(MQTT_USER, MQTT_PASS)
    c.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
    c.loop_start()
    return c

def publish(cm: float, valid: bool):
    topic = f"parking/slot/{SLOT_ID}/telemetry"
    status = "unknown" if not valid else decide_status(cm)

    payload = {
        "slot_id": SLOT_ID,
        "status": status,
        "distance_cm": round(cm, 1) if valid else None,
        "distance_valid": bool(valid),
        "battery_mv": 3710,
        "battery_percent": 82,
        "rssi_dbm": -60,
        "snr_db": 7.5,
        "timestamp": now_time_only_utc(),
        "raw": "PC_GUI" if valid else "ERR",
        "source": "pc_streamlit",
    }

    client = get_client()
    client.publish(topic, json.dumps(payload), qos=0, retain=False)
    return topic, payload

st.title("Parking Slot Simulator (PC → MQTT)")

cm = st.slider("Distance (cm)", min_value=0.0, max_value=200.0, value=60.0, step=0.1)
valid = st.toggle("Valid reading", value=True)

status = "unknown" if not valid else decide_status(cm)
st.metric("Status", status)

col1, col2 = st.columns(2)
with col1:
    if st.button("Publish now"):
        topic, payload = publish(cm, valid)
        st.success(f"Published to {topic}")
        st.json(payload)

with col2:
    auto = st.toggle("Auto publish every 2s", value=False)

if auto:
    # simple auto loop using rerun
    topic, payload = publish(cm, valid)
    st.info(f"Auto published to {topic}")
    st.json(payload)
    time.sleep(2)
    st.rerun()
