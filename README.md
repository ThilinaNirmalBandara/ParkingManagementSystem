# IoT Parking Management System (Simulated)

## Flow
1. MQTT devices → Mosquitto broker
2. Backend (Node.js) subscribes, stores in MongoDB, and broadcasts via Socket.IO
3. Frontend (React) shows slots live in red/green

## Run
```bash
docker-compose up -d
cd backend && npm install && npm start
cd frontend && npm install && npm start
