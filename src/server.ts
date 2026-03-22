import dotenv from "dotenv";
import http from "http";
import app from "./app";
import connectDB from "./config/db";
import { initSocket } from "./socket";

dotenv.config();

const PORT = process.env.PORT || 5000;

/**
 * Start server only after DB connects
 */
const startServer = async () => {
  await connectDB();

  // 🔥 Create HTTP server
  const server = http.createServer(app);

  // 🔥 Initialize Socket.IO
  initSocket(server);

  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
};

startServer();