import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Data file path
const DATA_FILE = join(__dirname, 'data', 'state.json');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files from dist folder (after build)
app.use(express.static(join(__dirname, 'dist')));

// Initialize data file if it doesn't exist
const initializeDataFile = () => {
  if (!existsSync(DATA_FILE)) {
    const initialState = {
      overhead: { salary: 47000, tech: 4855, admin: 12800 },
      rpmSeasonality: {
        Mar: 0.75, Apr: 0.85, May: 0.90, Jun: 0.88, 
        Jul: 0.85, Aug: 0.88, Sep: 0.95, Oct: 1.05, 
        Nov: 1.25, Dec: 1.35
      },
      baselineData: null,
      syndConfigs: null,
      hiringPlans: null,
      discConfigs: null,
      lastUpdated: new Date().toISOString(),
      updatedBy: 'system'
    };
    writeFileSync(DATA_FILE, JSON.stringify(initialState, null, 2));
    console.log('Initialized data file');
  }
};

// API Routes

// GET - Fetch current state
app.get('/api/state', (req, res) => {
  try {
    initializeDataFile();
    const data = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error reading state:', error);
    res.status(500).json({ success: false, error: 'Failed to read state' });
  }
});

// POST - Save state
app.post('/api/state', (req, res) => {
  try {
    const newState = {
      ...req.body,
      lastUpdated: new Date().toISOString()
    };
    writeFileSync(DATA_FILE, JSON.stringify(newState, null, 2));
    console.log(`State saved at ${newState.lastUpdated}`);
    res.json({ success: true, message: 'State saved successfully' });
  } catch (error) {
    console.error('Error saving state:', error);
    res.status(500).json({ success: false, error: 'Failed to save state' });
  }
});

// POST - Reset to defaults
app.post('/api/reset', (req, res) => {
  try {
    const initialState = {
      overhead: { salary: 47000, tech: 4855, admin: 12800 },
      rpmSeasonality: {
        Mar: 0.75, Apr: 0.85, May: 0.90, Jun: 0.88, 
        Jul: 0.85, Aug: 0.88, Sep: 0.95, Oct: 1.05, 
        Nov: 1.25, Dec: 1.35
      },
      baselineData: null,
      syndConfigs: null,
      hiringPlans: null,
      discConfigs: null,
      lastUpdated: new Date().toISOString(),
      updatedBy: 'system-reset'
    };
    writeFileSync(DATA_FILE, JSON.stringify(initialState, null, 2));
    res.json({ success: true, message: 'State reset to defaults' });
  } catch (error) {
    console.error('Error resetting state:', error);
    res.status(500).json({ success: false, error: 'Failed to reset state' });
  }
});

// GET - Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Catch-all: serve index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  initializeDataFile();
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Data file: ${DATA_FILE}`);
});
