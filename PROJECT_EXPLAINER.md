# 📖 APT Real-Time Order Monitor — Project Explainer

This document explains **everything** about how the system works — from the database triggers to the WebSocket events to the Postman requests you can fire to test it.

---

## 🎯 What Does This Project Do?

It's a **real-time order monitoring dashboard**. When you add, update, or delete an order in the MySQL database (via Postman, SQL, or any client), the React dashboard **instantly** reflects the change — no page refresh needed.

This is achieved through a technique called **Change Data Capture (CDC)**.

---

## 🔄 How the System Works (End-to-End)

### Step 1: MySQL Triggers Capture Changes

When you INSERT/UPDATE/DELETE a row in the `orders` table, MySQL **triggers** automatically fire and write a log entry to a `change_log` table:

```sql
-- Example: After an INSERT on orders
CREATE TRIGGER after_order_insert
AFTER INSERT ON orders
FOR EACH ROW
BEGIN
  INSERT INTO change_log (order_id, operation_type) VALUES (NEW.id, 'INSERT');
END;
```

The `change_log` table looks like:

| id | order_id | operation_type | created_at |
|----|----------|---------------|------------|
| 1  | 5        | INSERT         | 2026-05-19 13:00:00 |
| 2  | 5        | UPDATE         | 2026-05-19 13:01:00 |
| 3  | 3        | DELETE         | 2026-05-19 13:02:00 |

### Step 2: Node.js Watcher Polls the Log

The file `backend/src/services/watcher.ts` runs a `setInterval` every **1 second** that queries:

```sql
SELECT * FROM change_log WHERE id > ? ORDER BY id ASC
```

It keeps track of the `lastSeenId` so it only processes **new** changes. This is efficient because:
- It's a simple indexed query
- It only returns unprocessed rows
- No locking or heavy operations

### Step 3: Watcher Emits WebSocket Events

For each new change found, the watcher:
1. Fetches the **full order data** from the `orders` table (for INSERT/UPDATE)
2. Emits a Socket.IO event called `order_change` with a rich payload:

```typescript
io.emit("order_change", {
  event: "INSERT",              // INSERT | UPDATE | DELETE
  orderId: 5,
  customerName: "Aditya",       // from the order row
  productName: "Keyboard",      // from the order row
  data: { /* full order object */ },
  timestamp: "2026-05-19T13:00:00.000Z"
});
```

### Step 4: React Frontend Receives & Renders

The React app (`App.tsx`) listens for `order_change` events:

```typescript
socket.on("order_change", (payload) => {
  fetchOrders();  // re-fetch the full orders list
  // Add to event stream: "1:09 PM | INSERT | Aditya | Keyboard"
});
```

The event stream shows **what** changed, **who** it was, and **what product** — not just an order number.

### Step 5: Connected Client Tracking

The server also tracks how many browser tabs are connected:

```typescript
io.on("connection", (socket) => {
  clientCount++;
  io.emit("client_count", clientCount);

  socket.on("disconnect", () => {
    clientCount--;
    io.emit("client_count", clientCount);
  });
});
```

Open 3 tabs → the dashboard shows "3 tabs active". Close one → it drops to 2. This is real server-side WebSocket session management.

---

## 🧪 Testing with Postman

Here's every request you can make and what happens:

### 1. Create an Order (triggers INSERT event)

```
POST http://localhost:5000/orders
Content-Type: application/json

{
  "customer_name": "Aditya",
  "product_name": "Keyboard",
  "status": "pending"
}
```

**What happens:**
- Row inserted into `orders` table
- MySQL trigger writes to `change_log`: `INSERT, order_id=N`
- Watcher picks it up within 1 second
- Dashboard shows new row + event: `1:09 PM | NEW | Aditya | Keyboard`

### 2. Update an Order (triggers UPDATE event)

```
PUT http://localhost:5000/orders/1
Content-Type: application/json

{
  "status": "shipped"
}
```

**What happens:**
- `orders.status` updated to "shipped"
- Trigger logs: `UPDATE, order_id=1`
- Dashboard status pill changes from yellow "PENDING" to blue "SHIPPED"
- Event stream: `1:10 PM | UPD | Aditya | Keyboard`

### 3. Delete an Order (triggers DELETE event)

```
DELETE http://localhost:5000/orders/1
```

**What happens:**
- Row removed from `orders`
- Trigger logs: `DELETE, order_id=1`
- Dashboard removes the row
- Event stream: `1:11 PM | DEL | — | —` (data unavailable since row is deleted)

### 4. Get All Orders

```
GET http://localhost:5000/orders
```

Returns the full list of orders, sorted newest first.

### 5. Health Check

```
GET http://localhost:5000/health
```

Returns:
```json
{
  "status": "ok",
  "uptime": 120,
  "database": "connected",
  "dbLatencyMs": 2,
  "timestamp": "2026-05-19T13:15:00.000Z"
}
```

This endpoint proves the server is alive and the database is reachable. In production, load balancers and Kubernetes use endpoints like this for **liveness probes**.

---

## 🗄️ Database Schema

### `orders` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT AUTO_INCREMENT | Primary key |
| `customer_name` | VARCHAR(255) | Who placed the order |
| `product_name` | VARCHAR(255) | What was ordered |
| `status` | ENUM('pending','shipped','delivered') | Current order state |
| `updated_at` | TIMESTAMP | Auto-updates on modification |

### `change_log` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT AUTO_INCREMENT | Primary key, used as cursor by watcher |
| `order_id` | INT | References which order changed |
| `operation_type` | ENUM('INSERT','UPDATE','DELETE') | What type of change |
| `created_at` | TIMESTAMP | When the change happened |

### Triggers (3 total)

- `after_order_insert` — fires after INSERT on orders
- `after_order_update` — fires after UPDATE on orders
- `after_order_delete` — fires after DELETE on orders

Each one simply inserts a row into `change_log`.

---

## 📂 File-by-File Breakdown

### Backend

| File | Purpose |
|------|---------|
| `server.ts` | Sets up Express, Socket.IO, registers routes, tracks connected clients |
| `db.ts` | Creates a MySQL connection pool using environment variables |
| `routes/orders.ts` | REST CRUD — GET all, POST create, PUT update status, DELETE |
| `routes/health.ts` | Health check endpoint — pings DB, reports uptime |
| `services/watcher.ts` | Polls `change_log` every 1s, emits `order_change` events via Socket.IO |

### Frontend

| File | Purpose |
|------|---------|
| `App.tsx` | Main component — renders header, stats, orders table, event stream |
| `index.css` | Global reset + dark theme + Inter font |
| `main.tsx` | React DOM entry point |
| `index.html` | HTML shell with Vite script tag |

---

## 🔑 Key Concepts to Understand

### Change Data Capture (CDC)
Instead of the frontend asking "has anything changed?" every second, the **database itself** records every change. The backend **watches** the change log and **pushes** updates to clients. This is the same pattern used by tools like Debezium, Maxwell, and AWS DMS at enterprise scale.

### Why Triggers + Polling (not Binlog)?
- **Simplicity** — No external tools needed. Pure SQL.
- **Portability** — Works on any MySQL setup, even shared hosting.
- **Tradeoff** — 1-second latency vs. millisecond latency with binlog streaming. For an order monitoring dashboard, 1 second is perfectly fine.

### WebSocket vs HTTP Polling
- **HTTP Polling:** Client asks server every X seconds → wasteful, latency = polling interval
- **WebSocket:** Server pushes to client the instant something happens → efficient, near-zero latency
- This project uses **Socket.IO**, which upgrades HTTP to WebSocket and falls back gracefully.

### Connection Pool (`mysql2/promise`)
Instead of opening a new MySQL connection for every request (expensive), we create a **pool** of reusable connections. The pool handles connection lifecycle automatically.

---

## 💡 What Makes This a Good Backend Project

1. **It's event-driven** — not just CRUD. The CDC + WebSocket pipeline shows real-time data engineering skills.
2. **It uses database-level automation** — triggers are an underused but powerful feature.
3. **It decouples data mutation from notification** — anyone can write to `orders` (Postman, SQL CLI, another microservice) and the dashboard reflects it. The producer doesn't need to know about the consumer.
4. **It has a health endpoint** — a small but important production-readiness signal.
5. **It tracks active connections** — demonstrates understanding of WebSocket session lifecycle on the server side.
