 Atypical Technologies- Assignment

A full-stack **Change Data Capture (CDC)** system that monitors a MySQL `orders` table in real-time and pushes live updates to connected browser clients via WebSockets.

> **Core idea:** When anyone (you via Postman, another service, or a raw SQL query) changes the `orders` table, the dashboard updates instantly — zero polling from the frontend.

---

## 🏗️ Architecture


<img width="1100" height="800" alt="ChatGPT Image May 19, 2026, 01_48_23 PM" src="https://github.com/user-attachments/assets/108a50d1-06da-47cf-92ca-c42975282078" />


### Data Flow 

1. **A change happens** — Someone INSERTs, UPDATEs, or DELETEs a row in the `orders` table (via Postman, MySQL CLI, or any client)
2. **MySQL trigger fires** — A DB-level trigger automatically logs the change into a `change_log` table with the operation type and order ID
3. **Watcher polls** — The Node.js watcher service queries `change_log` every 1 second for new entries (rows with ID > last seen)
4. **Server emits** — For each new change, the watcher fetches the current order data and emits an `order_change` event via Socket.IO
5. **Frontend reacts** — All connected React clients receive the event, refresh the orders list, and append the event to the live stream

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Database** | MySQL 8+ | Relational, supports triggers natively |
| **Backend Runtime** | Node.js + TypeScript | Type-safe server-side JS |
| **HTTP Framework** | Express 5 | Industry-standard REST API framework |
| **Real-Time** | Socket.IO | WebSocket abstraction with fallback support |
| **CDC Mechanism** | MySQL Triggers + Polling | Lightweight CDC without external tools (Debezium, etc.) |
| **Frontend** | React 19 + Vite | Fast dev server, modern React with hooks |
| **HTTP Client** | Axios | Promise-based HTTP for REST calls |

---

## 📁 Project Structure

```
at_assignement/
├── backend/
│   ├── src/
│   │   ├── server.ts          # Express + Socket.IO setup, client tracking
│   │   ├── db.ts              # MySQL connection pool
│   │   ├── routes/
│   │   │   ├── orders.ts      # CRUD REST API for orders
│   │   │   └── health.ts      # GET /health — server status endpoint
│   │   └── services/
│   │       └── watcher.ts     # Polls change_log, emits WebSocket events
│   ├── .env                   # DB credentials (not committed)
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx            # Main dashboard UI
│   │   ├── index.css          # Global styles
│   │   └── main.tsx           # React entry point
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── .gitignore
└── README.md
```

---

##  How to Run

### Prerequisites

- **Node.js** 18+ and npm
- **MySQL** 8+ running locally
- A database named `apt_orders`

### 1. Database Setup

```sql
CREATE DATABASE IF NOT EXISTS apt_orders;
USE apt_orders;

-- Orders table
CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  status ENUM('pending', 'shipped', 'delivered') DEFAULT 'pending',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Change log table (CDC)
CREATE TABLE change_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  operation_type ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Triggers
DELIMITER //

CREATE TRIGGER after_order_insert
AFTER INSERT ON orders
FOR EACH ROW
BEGIN
  INSERT INTO change_log (order_id, operation_type) VALUES (NEW.id, 'INSERT');
END //

CREATE TRIGGER after_order_update
AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
  INSERT INTO change_log (order_id, operation_type) VALUES (NEW.id, 'UPDATE');
END //

CREATE TRIGGER after_order_delete
AFTER DELETE ON orders
FOR EACH ROW
BEGIN
  INSERT INTO change_log (order_id, operation_type) VALUES (OLD.id, 'DELETE');
END //

DELIMITER ;
```

### 2. Backend

```bash
cd backend
npm install
npx ts-node src/server.ts
```

Server starts on `http://localhost:5000`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Dashboard opens on `http://localhost:5173`

---

## API Reference

### `GET /orders`
Returns all orders sorted by most recent.

**Response:**
```json
[
  {
    "id": 1,
    "customer_name": "Aditya",
    "product_name": "Keyboard",
    "status": "pending",
    "updated_at": "2026-05-19T07:30:00.000Z"
  }
]
```

### `POST /orders`
Creates a new order.

**Request Body:**
```json
{
  "customer_name": "Aditya",
  "product_name": "Keyboard",
  "status": "pending"
}
```

**Response:**
```json
{ "message": "Order created" }
```

### `PUT /orders/:id`
Updates an order's status.

**Request Body:**
```json
{
  "status": "shipped"
}
```

**Response:**
```json
{ "message": "Order updated" }
```

### `DELETE /orders/:id`
Deletes an order.

**Response:**
```json
{ "message": "Order deleted" }
```

### `GET /health`
Returns server health status.

**Response:**
```json
{
  "status": "ok",
  "uptime": 3600,
  "database": "connected",
  "dbLatencyMs": 2,
  "timestamp": "2026-05-19T07:30:00.000Z"
}
```

---

## 🔌 WebSocket Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `order_change` | Server → Client | `{ event, orderId, customerName, productName, data, timestamp }` |
| `client_count` | Server → Client | `number` (total connected tabs) |

---

## 📈 Scalability Considerations

### Current Design (Single Server)
Works great for demos and small workloads. The 1-second polling on `change_log` is extremely lightweight — a simple `SELECT WHERE id > ?` on an indexed column.

### Scaling Horizontally

| Challenge | Solution |
|-----------|----------|
| **Multiple Node.js instances** | Use `socket.io-redis` adapter so all instances share WebSocket state |
| **Database polling bottleneck** | Replace trigger-based CDC with **MySQL binlog** readers (e.g., Debezium, Maxwell) that stream changes without polling |
| **High write throughput** | Partition `change_log` by date, add TTL cleanup job |
| **Frontend load** | Serve React via CDN, backend becomes pure API + WebSocket |
| **Monitoring** | `GET /health` already exists — plug into Kubernetes liveness probes or uptime monitors |

### Why This Architecture Scales Well

1. **Decoupled producers & consumers** — The trigger writes to `change_log` independently of who consumes it. Add more consumers (email service, analytics) without touching the DB schema.
2. **Stateless HTTP layer** — Express routes are pure request/response. Horizontal scaling with a load balancer is trivial.
3. **WebSocket fan-out** — Socket.IO handles broadcasting to N clients from a single event emission. With the Redis adapter, this works across multiple server instances.

---

##  Key Backend Concepts Demonstrated

- **Change Data Capture (CDC)** — Capturing DB mutations as events
- **MySQL Triggers** — Database-level automation
- **WebSocket real-time push** — Server-to-client event streaming
- **Connection pooling** — `mysql2/promise` pool for efficient DB access
- **REST API design** — Standard CRUD with proper HTTP methods
- **Health check endpoint** — Production readiness pattern
- **Client connection tracking** — Server-side WebSocket session management
- **TypeScript on Node.js** — Type-safe backend development

---


