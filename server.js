import express from "express";
import cors from "cors";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Data file path
const DATA_DIR = join(__dirname, "data");
const DATA_FILE = join(DATA_DIR, "state.json");

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Serve static files from dist folder (after build)
app.use(express.static(join(__dirname, "dist")));

// Default initial state
const getInitialState = () => ({
  overhead: { salary: 47000, tech: 4855, admin: 12800 },
  rpmSeasonality: {
    Mar: 0.75,
    Apr: 0.85,
    May: 0.9,
    Jun: 0.88,
    Jul: 0.85,
    Aug: 0.88,
    Sep: 0.95,
    Oct: 1.05,
    Nov: 1.25,
    Dec: 1.35,
  },
  baselineData: null,
  syndConfigs: null,
  hiringPlans: null,
  discConfigs: null,
  lastUpdated: new Date().toISOString(),
  updatedBy: "system",
});

// In-memory state (fallback if file system fails)
let memoryState = getInitialState();

// Try to load from file, otherwise use memory
const loadState = () => {
  try {
    if (existsSync(DATA_FILE)) {
      const data = JSON.parse(readFileSync(DATA_FILE, "utf8"));
      memoryState = data;
      return data;
    }
  } catch (error) {
    console.log("Could not read from file, using memory state");
  }
  return memoryState;
};

// Try to save to file, always update memory
const saveState = (state) => {
  memoryState = state;
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
    console.log("State saved to file");
  } catch (error) {
    console.log("Could not save to file, state saved in memory only");
  }
};

// API Routes

// GET - Fetch current state
app.get("/api/state", (req, res) => {
  const data = loadState();
  res.json({ success: true, data });
});

// POST - Save state
app.post("/api/state", (req, res) => {
  const newState = {
    ...req.body,
    lastUpdated: new Date().toISOString(),
  };
  saveState(newState);
  res.json({ success: true, message: "State saved successfully" });
});

// POST - Reset to defaults
app.post("/api/reset", (req, res) => {
  const initialState = getInitialState();
  saveState(initialState);
  res.json({ success: true, message: "State reset to defaults" });
});

// GET - Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Catch-all: serve index.html for client-side routing
app.get("*", (req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

// Start server
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  loadState();
});

server.on("error", (err) => {
  console.error("Server error:", err);
});
