import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import meetingRoutes from "./routes/meeting.routes";

const app = express();

/**
 * Global Middleware
 * These run for every request
 */
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/meetings", meetingRoutes);

/**
 * Health Check Route
 * Used to verify server is alive
 */
app.get("/health", (_req, res) => {
  res.status(200).send("Backend is running 🚀");
});

export default app;
