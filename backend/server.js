// backend/server.js
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io'); 
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// --- Standard HTTP Routes ---

app.get('/api/health', async (req, res) => {
  try {
    const dbResult = await db.query('SELECT NOW()');
    res.json({ 
      status: "healthy", 
      message: "Backend is connected to the internet!",
      database: "Connected!",
      timestamp: dbResult.rows[0].now
    });
  } catch (err) {
    console.error("Database connection error:", err);
    res.status(500).json({ status: "error", message: "Database connection failed." });
  }
});

app.post('/api/users/login', async (req, res) => {
  const { username } = req.body;
  if (!username || username.trim() === "") {
    return res.status(400).json({ error: "Username is required." });
  }

  const baseName = username.trim();

  try {
    const countQuery = 'SELECT COUNT(*) FROM users WHERE base_name = $1';
    const countResult = await db.query(countQuery, [baseName]);
    const existingCount = parseInt(countResult.rows[0].count, 10);

    let displayName = baseName;
    if (existingCount > 0) {
      displayName = `${baseName} ${existingCount + 1}`;
    }

    const insertQuery = `
      INSERT INTO users (base_name, display_name) 
      VALUES ($1, $2) 
      RETURNING session_token, display_name
    `;
    const insertResult = await db.query(insertQuery, [baseName, displayName]);
    const newUser = insertResult.rows[0];

    res.status(201).json({
      message: "Session initialized successfully.",
      sessionToken: newUser.session_token,
      displayName: newUser.display_name
    });
  } catch (err) {
    console.error("Login processing error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// --- Real-Time Socket.io Connection Logic ---

io.on('connection', (socket) => {
  console.log(`⚡ A user connected: ${socket.id}`);

  socket.on('join_lobby', (data) => {
    console.log(`⚓ Player ${data.playerName} has entered the Matchmaking Lounge.`);
  });

  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});