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

// Health check
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`Hub Service API running at http://localhost:${PORT}`);
});