import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import dotenv from "dotenv";
import orderRoutes from "./routes/orders";
import healthRoutes from "./routes/health";
import { startWatcher } from "./services/watcher";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

export const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

let clientCount = 0;

io.on("connection", (socket) => {
  clientCount++;
  console.log("Client connected:", socket.id, "| Total:", clientCount);
  io.emit("client_count", clientCount);

  socket.on("disconnect", () => {
    clientCount--;
    console.log("Client disconnected:", socket.id, "| Total:", clientCount);
    io.emit("client_count", clientCount);
  });
});

app.use("/orders", orderRoutes);
app.use("/health", healthRoutes);

startWatcher();

server.listen(process.env.PORT, () => {
  console.log(`Server running on ${process.env.PORT}`);
});
