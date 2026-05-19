import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import axios from "axios";

const socket = io("http://localhost:5000");

type Order = {
  id: number;
  customer_name: string;
  product_name: string;
  status: string;
  updated_at: string;
};

type EventItem = {
  message: string;
  type: string;
  time: string;
  customer: string;
  product: string;
};

function App() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [connected, setConnected] = useState(false);
  const [clientCount, setClientCount] = useState(0);

  const fetchOrders = async () => {
    const res = await axios.get("http://localhost:5000/orders");
    setOrders(res.data);
  };

  useEffect(() => {
    fetchOrders();

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("client_count", (count: number) => {
      setClientCount(count);
    });

    socket.on("order_change", (payload) => {
      fetchOrders();

      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const msg = `${time} | ${payload.event} | ${payload.customerName} | ${payload.productName}`;

      setEvents((prev) => [
        {
          message: msg,
          type: payload.event,
          time,
          customer: payload.customerName,
          product: payload.productName,
        },
        ...prev.slice(0, 19),
      ]);
    });

    return () => {
      socket.off("order_change");
      socket.off("client_count");
    };
  }, []);

  const statusColor = (status: string) => {
    if (status === "pending") return "#f59e0b";
    if (status === "shipped") return "#3b82f6";
    if (status === "delivered") return "#22c55e";
    return "#fff";
  };

  const statusBg = (status: string) => {
    if (status === "pending") return "rgba(245,158,11,0.12)";
    if (status === "shipped") return "rgba(59,130,246,0.12)";
    if (status === "delivered") return "rgba(34,197,94,0.12)";
    return "transparent";
  };

  const eventColor = (type: string) => {
    if (type === "INSERT") return "#22c55e";
    if (type === "UPDATE") return "#f59e0b";
    if (type === "DELETE") return "#ef4444";
    return "#3b82f6";
  };

  const eventLabel = (type: string) => {
    if (type === "INSERT") return "NEW";
    if (type === "UPDATE") return "UPD";
    if (type === "DELETE") return "DEL";
    return type;
  };

  return (
    <div style={pageStyle}>
      {/* Header */}
      <header style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={logoStyle}>⚡</div>
          <div>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 700, letterSpacing: "-0.5px" }}>
              APT Real-Time Order Monitor
            </h1>
            <p style={{ margin: 0, fontSize: "13px", color: "#94a3b8", marginTop: "2px" }}>
              MySQL Change-Data-Capture → WebSocket → React
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={pillStyle}>
            <span style={{
              width: "8px", height: "8px", borderRadius: "50%",
              background: connected ? "#22c55e" : "#ef4444",
              display: "inline-block",
              boxShadow: connected ? "0 0 8px #22c55e" : "0 0 8px #ef4444",
              animation: connected ? "pulse 2s infinite" : "none",
            }} />
            <span style={{ fontSize: "13px", color: connected ? "#22c55e" : "#ef4444" }}>
              {connected ? "WebSocket Live" : "Disconnected"}
            </span>
          </div>
        </div>
      </header>

      {/* Stats Row */}
      <div style={statsRowStyle}>
        <div style={statCardStyle}>
          <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748b", letterSpacing: "1px", fontWeight: 600 }}>
            Total Orders
          </div>
          <div style={{ fontSize: "32px", fontWeight: 700, color: "#e2e8f0", marginTop: "4px" }}>
            {orders.length}
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748b", letterSpacing: "1px", fontWeight: 600 }}>
            Connected Clients
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "4px" }}>
            <span style={{ fontSize: "32px", fontWeight: 700, color: "#e2e8f0" }}>
              {clientCount}
            </span>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              tab{clientCount !== 1 ? "s" : ""} active
            </span>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748b", letterSpacing: "1px", fontWeight: 600 }}>
            Pending
          </div>
          <div style={{ fontSize: "32px", fontWeight: 700, color: "#f59e0b", marginTop: "4px" }}>
            {orders.filter((o) => o.status === "pending").length}
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748b", letterSpacing: "1px", fontWeight: 600 }}>
            Delivered
          </div>
          <div style={{ fontSize: "32px", fontWeight: 700, color: "#22c55e", marginTop: "4px" }}>
            {orders.filter((o) => o.status === "delivered").length}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={mainGridStyle}>
        {/* Orders Table */}
        <div style={tableContainerStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "#e2e8f0" }}>
              📋 Live Orders
            </h2>
            <span style={{ fontSize: "12px", color: "#64748b", background: "#1e293b", padding: "4px 10px", borderRadius: "20px" }}>
              Auto-refreshing
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>Customer</th>
                  <th style={thStyle}>Product</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} style={{ transition: "background 0.2s" }}>
                    <td style={tdStyle}>
                      <span style={{ color: "#64748b", fontFamily: "monospace" }}>#{o.id}</span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 500, color: "#e2e8f0" }}>{o.customer_name}</span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ color: "#cbd5e1" }}>{o.product_name}</span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        color: statusColor(o.status),
                        background: statusBg(o.status),
                        padding: "4px 12px",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}>
                        {o.status}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ color: "#64748b", fontSize: "13px" }}>
                        {new Date(o.updated_at).toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Event Log */}
        <div style={eventContainerStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "#e2e8f0" }}>
              🔔 Event Stream
            </h2>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              last {events.length}
            </span>
          </div>

          <div style={{ maxHeight: "520px", overflowY: "auto", paddingRight: "4px" }}>
            {events.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "40px 20px", color: "#475569",
                border: "1px dashed #334155", borderRadius: "8px",
              }}>
                <p style={{ fontSize: "24px", marginBottom: "8px" }}>📡</p>
                <p style={{ fontSize: "13px" }}>Waiting for database events…</p>
                <p style={{ fontSize: "11px", marginTop: "4px", color: "#334155" }}>
                  Try INSERT / UPDATE / DELETE on the orders table
                </p>
              </div>
            ) : (
              events.map((e, i) => (
                <div key={i} style={{
                  background: "#0f172a",
                  borderLeft: `3px solid ${eventColor(e.type)}`,
                  borderRadius: "6px",
                  padding: "10px 12px",
                  marginBottom: "8px",
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}>
                  <span style={{
                    background: eventColor(e.type),
                    color: "#0f172a",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "0.5px",
                    flexShrink: 0,
                  }}>
                    {eventLabel(e.type)}
                  </span>
                  <span style={{ color: "#94a3b8", flexShrink: 0 }}>{e.time}</span>
                  <span style={{ color: "#e2e8f0" }}>{e.customer}</span>
                  <span style={{ color: "#64748b" }}>·</span>
                  <span style={{ color: "#cbd5e1" }}>{e.product}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{
        textAlign: "center", padding: "16px", fontSize: "12px", color: "#334155",
        borderTop: "1px solid #1e293b", marginTop: "auto",
      }}>
        Built with Node.js · Express · MySQL Triggers · Socket.IO · React
      </footer>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        tr:hover td { background: rgba(59,130,246,0.04) !important; }
      `}</style>
    </div>
  );
}

/* ---------- Style objects ---------- */
const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#0b1120",
  color: "#e2e8f0",
  fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
  display: "flex",
  flexDirection: "column",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "16px 28px",
  borderBottom: "1px solid #1e293b",
  background: "rgba(15,23,42,0.8)",
  backdropFilter: "blur(12px)",
  position: "sticky",
  top: 0,
  zIndex: 10,
};

const logoStyle: React.CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "10px",
  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "18px",
};

const pillStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  background: "#1e293b",
  padding: "6px 14px",
  borderRadius: "20px",
};

const statsRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "12px",
  padding: "20px 28px",
};

const statCardStyle: React.CSSProperties = {
  background: "#111827",
  border: "1px solid #1e293b",
  borderRadius: "12px",
  padding: "16px 20px",
};

const mainGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "3fr 2fr",
  gap: "16px",
  padding: "0 28px 28px",
  flex: 1,
};

const tableContainerStyle: React.CSSProperties = {
  background: "#111827",
  border: "1px solid #1e293b",
  borderRadius: "12px",
  padding: "20px",
};

const eventContainerStyle: React.CSSProperties = {
  background: "#111827",
  border: "1px solid #1e293b",
  borderRadius: "12px",
  padding: "20px",
};

const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "left",
  fontSize: "11px",
  textTransform: "uppercase",
  letterSpacing: "1px",
  color: "#64748b",
  borderBottom: "1px solid #1e293b",
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid rgba(30,41,59,0.5)",
  fontSize: "14px",
  transition: "background 0.2s",
};

export default App;