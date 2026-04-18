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

// Path to the venv python and the model folder
const PYTHON    = path.resolve(__dirname, process.env.PYTHON_PATH ?? "../model/venv/Scripts/python.exe");
const RUNNER    = path.join(__dirname, "../model/api_runner.py");
const MODEL_DIR = path.join(__dirname, "../model");

// GET /api/simulate?days=10
app.get("/api/simulate", (req, res) => {
  const days = parseInt(req.query.days) || 10;

  if (days < 1 || days > 30) {
    return res.status(400).json({ error: "days must be between 1 and 30" });
  }

  let output = "";
  let errOutput = "";

  const py = spawn(PYTHON, [RUNNER, String(days)], { cwd: MODEL_DIR });

  py.stdout.on("data", (data) => { output += data.toString(); });
  py.stderr.on("data", (data) => { errOutput += data.toString(); });

  py.on("close", (code) => {
    if (code !== 0) {
      console.error("Python error:", errOutput);
      return res.status(500).json({ error: "Simulation failed", details: errOutput });
    }
    try {
      const result = JSON.parse(output);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: "Failed to parse simulation output", raw: output });
    }
  });

  py.on("error", (err) => {
    res.status(500).json({ error: "Failed to start Python process", details: err.message });
  });
});

const PREDICTOR = path.join(__dirname, "../model/lstm_predictor.py");

app.post("/api/predict_lstm", (req, res) => {
  let output = "";
  let errOutput = "";

  // The Python API hook expects the JSON string as argv[1]
  const py = spawn(PYTHON, [PREDICTOR, JSON.stringify(req.body)], { cwd: MODEL_DIR });

  py.stdout.on("data", (data) => { output += data.toString(); });
  py.stderr.on("data", (data) => { errOutput += data.toString(); });

  py.on("close", (code) => {
    try {
      // The Python pipeline outputs generic logs before printing the exact JSON string.
      // We seek the last valid JSON parseable block or trim it.
      // Usually it's strictly JSON since we mute logs, but let's parse safe.
      const resultObj = JSON.parse(output.trim());
      res.json(resultObj);
    } catch (e) {
      console.error("LSTM Parse Error:", errOutput, output);
      res.status(500).json({ error: "Failed to parse PyTorch output", raw: output, err: errOutput });
    }
  });

  py.on("error", (err) => {
    res.status(500).json({ error: "Failed to spawn PyTorch script process", details: err.message });
  });
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
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    res.sendFile(path.join(CLIENT_BUILD_PATH, "index.html"));
  } else {
    next();
  }
});

app.listen(PORT, () => {
  console.log(`Hub Service API running at http://localhost:${PORT}`);
});