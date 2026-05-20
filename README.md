# IoT-Based Smart Parking Monitoring System

A real-time parking slot monitoring system developed for **EN3251 – Internet of Things**. The system detects parking slot availability using low-power IoT end devices and updates a web dashboard in real time.

The key communication technology used in this project is **LoRa**, which allows low-power, long-range wireless communication between parking slot end devices and the central hub.

---

## Project Overview

Finding an available parking slot can be time-consuming when drivers do not have real-time visibility of parking availability. This project provides a smart IoT-based solution that monitors individual parking slots and displays their status instantly on a web dashboard.

Each parking slot has a battery-powered sensing node. The node detects whether a vehicle is present, measures battery status, records signal strength, and sends telemetry data to a central hub using **LoRa RA-02 (SX1278)** modules operating at **433 MHz**.

The central hub forwards the received data to the cloud/backend using MQTT. The backend stores the latest slot data in MongoDB and pushes live updates to the React dashboard using Socket.IO.

---

## Key Features

- Real-time parking slot availability monitoring
- Low-power end device design
- **LoRa-based wireless communication** between slot nodes and central hub
- MQTT-based telemetry publishing
- Node.js backend with MongoDB storage
- Socket.IO-based real-time dashboard updates
- React web dashboard for live visualization
- Battery level, RSSI, and timestamp monitoring
- Stale or missing sensor data detection support
- Manual override support through REST API for admin/testing purposes

---

## System Architecture

```text
Parking Slot End Device
  ├── Ultrasonic Sensor
  ├── ESP32 DevKit
  ├── Battery Monitoring
  └── LoRa RA-02 Transmitter
          │
          │ LoRa, 433 MHz
          ▼
Central Hub / Gateway
  ├── LoRa Receiver
  └── MQTT Publisher
          │
          │ MQTT JSON Telemetry
          ▼
Backend Server
  ├── Node.js
  ├── MongoDB
  ├── Socket.IO
  └── REST API
          │
          │ Real-time Updates
          ▼
React Web Dashboard
```

---

## Hardware Components

### End Device per Parking Slot

- ESP32 DevKit
- DYP A02 waterproof ultrasonic sensor
- LoRa RA-02 module based on SX1278
- Battery power supply
- Voltage sensing circuit for battery monitoring

### Gateway / Central Hub

- ESP32 or compatible microcontroller
- LoRa RA-02 receiver module
- Wi-Fi or Ethernet connectivity
- MQTT client for publishing telemetry to the backend/cloud

---

## Technologies Used

### IoT and Communication

- **LoRa** – End device to central hub communication
- MQTT – Hub to backend telemetry transfer
- HTTP/REST – Control and manual override operations
- Socket.IO – Real-time dashboard updates

### Backend

- Node.js
- Express.js
- MongoDB
- MQTT client
- Socket.IO

### Frontend

- React
- Socket.IO client
- REST API integration

---

## Telemetry Data Format

Each parking slot publishes telemetry data in JSON format.

```json
{
  "slot_id": "A01",
  "status": "free",
  "battery_voltage": 3.92,
  "battery_percentage": 86,
  "rssi": -72,
  "timestamp": "2026-05-20T10:30:00Z"
}
```

### Field Description

| Field | Description |
|---|---|
| `slot_id` | Unique identifier of the parking slot |
| `status` | Current slot state such as `free`, `occupied`, or `reserved` |
| `battery_voltage` | Battery voltage of the end device |
| `battery_percentage` | Estimated battery percentage |
| `rssi` | Received Signal Strength Indicator of the LoRa link |
| `timestamp` | Last update time from the sensor node |

---

## MQTT Topic Structure

The backend subscribes to telemetry messages using the following wildcard topic:

```text
parking/slot/+/telemetry
```

Example topic:

```text
parking/slot/A01/telemetry
```

---

## Backend Processing Flow

1. Backend subscribes to MQTT telemetry topics.
2. Incoming JSON payload is validated and parsed.
3. Slot data is upserted into MongoDB using `slot_id`.
4. A `slotUpdate` event is emitted using Socket.IO.
5. Connected dashboard clients receive the update instantly.
6. Health information can be checked through the `/api/health` endpoint.

---

## Dashboard

The React dashboard displays each parking slot with live status updates.

### Slot Color Indication

| Color | Meaning |
|---|---|
| Green | Free |
| Orange | Reserved |
| Red | Occupied |

The dashboard also shows:

- Slot ID
- Occupancy status
- Battery percentage
- RSSI value
- Last update time

---

## API Endpoints

### Health Check

```http
GET /api/health
```

Used to check whether the backend service is running.

### Manual Slot Override

```http
PUT /api/slots/:slot_id
```

Used for admin or testing purposes to manually update a slot status.

Example request body:

```json
{
  "status": "reserved"
}
```

---

## Setup Instructions

> Note: Update the commands according to your actual repository folder structure.

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/your-repository-name.git
cd your-repository-name
```

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

### 3. Configure Backend Environment Variables

Create a `.env` file inside the backend directory.

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/smart-parking
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=your_mqtt_username
MQTT_PASSWORD=your_mqtt_password
```

### 4. Run the Backend

```bash
npm start
```

### 5. Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

### 6. Run the React Dashboard

```bash
npm start
```

---

## Security Considerations

- MQTT broker authentication using username and password
- Login protection for the dashboard
- Input validation for telemetry data
- Controlled REST API access for manual overrides
- Monitoring of battery, RSSI, timestamps, and backend health logs

---

## IoT Design Considerations

This project follows important IoT design principles:

- Low-power sensing nodes
- Small telemetry payloads
- Infrequent data transmission
- Long-range communication using **LoRa**
- Cloud/backend offloading for storage and processing
- Real-time monitoring through lightweight event-based updates

---

## Future Improvements

- Add user authentication and role-based dashboard access
- Add historical analytics for slot usage
- Add alert notifications for low battery or stale data
- Improve enclosure design for outdoor deployment
- Add solar charging for end devices
- Deploy backend and dashboard on a cloud VM

---

## Team

**Team OPTIMA**  
Developed for **EN3251 – Internet of Things**

---

## License

This project is developed for academic purposes. Add a suitable license before public release.
