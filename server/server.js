import express from "express";
import cors from "cors";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

config(); // load .env

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static React files in production
const CLIENT_BUILD_PATH = path.join(__dirname, "../client/dist");
app.use(express.static(CLIENT_BUILD_PATH));

// Setup for Hugging Face API
const HF_MODEL_URL = process.env.HF_MODEL_URL || 'http://localhost:7860';

// GET /api/simulate?days=10
app.get("/api/simulate", async (req, res) => {
  const days = parseInt(req.query.days) || 10;
  if (days < 1 || days > 30) {
    return res.status(400).json({ error: "days must be between 1 and 30" });
  }

  try {
    const response = await fetch(`${HF_MODEL_URL}/api/simulate?days=${days}`);
    if (!response.ok) throw new Error(`HF API responded with ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Simulation proxy error:", err.message);
    res.status(500).json({ error: "Failed to fetch from Hugging Face model API", details: err.message });
  }
});

app.post("/api/predict_lstm", async (req, res) => {
  try {
    const response = await fetch(`${HF_MODEL_URL}/api/predict_lstm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    
    if (!response.ok) throw new Error(`HF API responded with ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("LSTM proxy error:", err.message);
    res.status(500).json({ error: "Failed to fetch from Hugging Face LSTM API", details: err.message });
  }
});

// Mock Admin Notification Relay
app.post("/api/notify_admin", (req, res) => {
  const { urgency, message, source } = req.body;
  
  // In a production system, this would integrate with AWS SNS, Twilio, SendGrid, or Slack API.
  console.log(`\n[ADMIN NOTIFICATION SENT]`);
  console.log(`Urgency: ${urgency}`);
  console.log(`Source:  ${source}`);
  console.log(`Message: ${message}\n`);
  
  res.json({ status: "success", delivered: true, details: "Admin notified via external channel." });
});

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

// Catch-all route to serve the React index.html for client-side routing
app.get("*", (req, res) => {
  res.sendFile(path.join(CLIENT_BUILD_PATH, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Hub Service API running at http://localhost:${PORT}`);
});