import express from "express";
import cors from "cors";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(join(__dirname, "dist")));

// In-memory state
let state = {
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
};

// Health check - Render needs this!
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// API Routes
app.get("/api/state", (req, res) => {
  res.json({ success: true, data: state });
});

app.post("/api/state", (req, res) => {
  state = { ...req.body, lastUpdated: new Date().toISOString() };
  res.json({ success: true, message: "Saved" });
});

app.post("/api/reset", (req, res) => {
  state = {
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
  };
  res.json({ success: true, message: "Reset" });
});

// Serve frontend
app.get("*", (req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server ready on port ${PORT}`);
});
