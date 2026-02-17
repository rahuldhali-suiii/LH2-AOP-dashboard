import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// ====================
// Setup
// ====================
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// ====================
// Database Setup
// ====================
const DATA_DIR = join(__dirname, "data");
const DB_FILE = join(DATA_DIR, "dashboard.db");

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
  console.log("📁 Created data directory:", DATA_DIR);
}

// Initialize SQLite
let db;
try {
  db = new Database(DB_FILE);
  db.pragma("journal_mode = WAL"); // Better performance
  console.log("✅ Connected to SQLite:", DB_FILE);
} catch (error) {
  console.error("❌ Failed to connect to SQLite:", error.message);
  process.exit(1);
}

// Create table
db.exec(`
  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    overhead TEXT,
    rpm_seasonality TEXT,
    baseline_data TEXT,
    synd_configs TEXT,
    hiring_plans TEXT,
    disc_configs TEXT,
    last_updated TEXT,
    updated_by TEXT
  )
`);
console.log("✅ Database table ready");

// ====================
// Default State (matches V8 App.jsx INITIAL values)
// ====================
const getDefaultState = () => ({
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

// ====================
// Database Functions
// ====================

// Check if state exists
const stateExists = () => {
  const row = db.prepare("SELECT id FROM app_state WHERE id = 1").get();
  return !!row;
};

// Initialize default state if empty
const initializeState = () => {
  if (!stateExists()) {
    const defaultState = getDefaultState();
    db.prepare(
      `
      INSERT INTO app_state (id, overhead, rpm_seasonality, baseline_data, synd_configs, hiring_plans, disc_configs, last_updated, updated_by)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      JSON.stringify(defaultState.overhead),
      JSON.stringify(defaultState.rpmSeasonality),
      JSON.stringify(defaultState.baselineData),
      JSON.stringify(defaultState.syndConfigs),
      JSON.stringify(defaultState.hiringPlans),
      JSON.stringify(defaultState.discConfigs),
      defaultState.lastUpdated,
      defaultState.updatedBy,
    );
    console.log("✅ Initialized database with default state");
  } else {
    console.log("✅ Existing state found in database");
  }
};

// Load state from database
const loadState = () => {
  const row = db
    .prepare(
      `
    SELECT overhead, rpm_seasonality, baseline_data, synd_configs, hiring_plans, disc_configs, last_updated, updated_by
    FROM app_state WHERE id = 1
  `,
    )
    .get();

  if (!row) {
    return getDefaultState();
  }

  return {
    overhead: JSON.parse(row.overhead),
    rpmSeasonality: JSON.parse(row.rpm_seasonality),
    baselineData: JSON.parse(row.baseline_data),
    syndConfigs: JSON.parse(row.synd_configs),
    hiringPlans: JSON.parse(row.hiring_plans),
    discConfigs: JSON.parse(row.disc_configs),
    lastUpdated: row.last_updated,
    updatedBy: row.updated_by,
  };
};

// Save state to database
const saveState = (state) => {
  const lastUpdated = new Date().toISOString();

  db.prepare(
    `
    UPDATE app_state SET
      overhead = ?,
      rpm_seasonality = ?,
      baseline_data = ?,
      synd_configs = ?,
      hiring_plans = ?,
      disc_configs = ?,
      last_updated = ?,
      updated_by = ?
    WHERE id = 1
  `,
  ).run(
    JSON.stringify(state.overhead),
    JSON.stringify(state.rpmSeasonality),
    JSON.stringify(state.baselineData),
    JSON.stringify(state.syndConfigs),
    JSON.stringify(state.hiringPlans),
    JSON.stringify(state.discConfigs),
    lastUpdated,
    state.updatedBy || "user",
  );

  return lastUpdated;
};

// Reset state to defaults
const resetState = () => {
  const defaultState = getDefaultState();

  db.prepare(
    `
    UPDATE app_state SET
      overhead = ?,
      rpm_seasonality = ?,
      baseline_data = ?,
      synd_configs = ?,
      hiring_plans = ?,
      disc_configs = ?,
      last_updated = ?,
      updated_by = ?
    WHERE id = 1
  `,
  ).run(
    JSON.stringify(defaultState.overhead),
    JSON.stringify(defaultState.rpmSeasonality),
    JSON.stringify(defaultState.baselineData),
    JSON.stringify(defaultState.syndConfigs),
    JSON.stringify(defaultState.hiringPlans),
    JSON.stringify(defaultState.discConfigs),
    defaultState.lastUpdated,
    "system-reset",
  );

  return defaultState;
};

// Initialize on startup
initializeState();

// ====================
// Middleware
// ====================
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(join(__dirname, "dist")));

// ====================
// API Routes (match V8 App.jsx exactly)
// ====================

// Health check
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// GET /api/state - Load state
app.get("/api/state", (req, res) => {
  try {
    const data = loadState();
    res.json({ success: true, data });
  } catch (error) {
    console.error("❌ GET /api/state error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/state - Save state
app.post("/api/state", (req, res) => {
  try {
    const lastUpdated = saveState(req.body);
    console.log("💾 State saved at", lastUpdated);
    res.json({ success: true, message: "State saved", lastUpdated });
  } catch (error) {
    console.error("❌ POST /api/state error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/reset - Reset to defaults
app.post("/api/reset", (req, res) => {
  try {
    resetState();
    console.log("🔄 State reset to defaults");
    res.json({ success: true, message: "State reset to defaults" });
  } catch (error) {
    console.error("❌ POST /api/reset error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================
// Serve Frontend
// ====================
app.get("*", (req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

// ====================
// Start Server
// ====================
app.listen(PORT, "0.0.0.0", () => {
  console.log("==================================");
  console.log("🚀 LH2 AOP Dashboard Server");
  console.log(`📍 Port: ${PORT}`);
  console.log(`📁 Database: ${DB_FILE}`);
  console.log("==================================");

  // Log current state summary
  const state = loadState();
  const syndCount = state.syndConfigs
    ? Object.keys(state.syndConfigs).length
    : 0;
  const discCount = state.discConfigs
    ? Object.keys(state.discConfigs).length
    : 0;
  console.log(
    `📊 Loaded: ${syndCount} syndication brands, ${discCount} discover brands`,
  );
});

// ====================
// Graceful Shutdown
// ====================
process.on("SIGINT", () => {
  console.log("\n👋 Shutting down...");
  db.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n👋 Shutting down...");
  db.close();
  process.exit(0);
});
