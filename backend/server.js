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
    const countQuery = 'SELECT COUNT(*) FROM battleship_users WHERE base_name = $1';
    const countResult = await db.query(countQuery, [baseName]);
    const existingCount = parseInt(countResult.rows[0].count, 10);

    let displayName = baseName;
    if (existingCount > 0) {
      displayName = `${baseName} ${existingCount + 1}`;
    }

    const insertQuery = `
      INSERT INTO battleship_users (base_name, display_name) 
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

  // Helper function
  const broadcastOpenLobbies = async () => {
    try {
      const queryText = `
        SELECT g.room_id, g.grid_size, g.ship_configuration, u.display_name as creator_name
        FROM battleship_game_sessions g
        JOIN battleship_users u ON g.creator_id = u.id
        WHERE g.status = 'waiting'
        ORDER BY g.created_at DESC
      `;
      const result = await db.query(queryText);
      io.emit('lobby_list_updated', result.rows);
    } catch (err) {
      console.error("Error fetching lobby list:", err);
    }
  };

  socket.on('join_lobby', async (data) => {
    console.log(`⚓ Player ${data.playerName} has entered the Matchmaking Lounge.`);
    await broadcastOpenLobbies();
  });

  socket.on('create_room', async (data) => {
    const { sessionToken, gridSize, shipConfiguration } = data;

    try {
      const userResult = await db.query(
        'SELECT id FROM battleship_users WHERE session_token = $1', 
        [sessionToken]
      );

      if (userResult.rows.length === 0) {
        return socket.emit('error_message', { message: 'Authentication invalid.' });
      }

      const creatorId = userResult.rows[0].id;

      // Insert the new game session with custom rule inputs into PostgreSQL
      const insertQuery = `
        INSERT INTO battleship_game_sessions (creator_id, grid_size, ship_configuration, status)
        VALUES ($1, $2, $3, 'waiting')
        RETURNING room_id
      `;
      const gameResult = await db.query(insertQuery, [
        creatorId, 
        gridSize || 10, 
        JSON.stringify(shipConfiguration || [])
      ]);

      const newRoomId = gameResult.rows[0].room_id;
      console.log(`🎲 Game Room Created: ${newRoomId} (Grid: ${gridSize}x${gridSize})`);

      // Let the creator join this specific private Socket.io room channel
      socket.join(newRoomId);
      socket.emit('room_created', { roomId: newRoomId });

      // Trigger live, real-time update to everyone else looking at the lobby list
      await broadcastOpenLobbies();

    } catch (err) {
      console.error("Failed to initialize game room:", err);
      socket.emit('error_message', { message: 'Database failure creating room.' });
    }
  });

  socket.on('join_room', async (data) => {
    const { sessionToken, roomId } = data;

    try {
      // Authenticate the incoming player
      const userResult = await db.query(
        'SELECT id, display_name FROM battleship_users WHERE session_token = $1',
        [sessionToken]
      );

      if (userResult.rows.length === 0) {
        return socket.emit('error_message', { message: 'Authentication invalid.' });
      }

      const opponentId = userResult.rows[0].id;
      const opponentName = userResult.rows[0].display_name;

      // Check if the game room is still open
      const roomCheck = await db.query(
        'SELECT creator_id, status FROM battleship_game_sessions WHERE room_id = $1',
        [roomId]
      );

      if (roomCheck.rows.length === 0) {
        return socket.emit('error_message', { message: 'Game session not found.' });
      }

      if (roomCheck.rows[0].status !== 'waiting') {
        return socket.emit('error_message', { message: 'Game room is already full or closed.' });
      }

      if (roomCheck.rows[0].creator_id === opponentId) {
        return socket.emit('error_message', { message: 'You cannot join your own match.' });
      }

      // Update the database: fill opponent slot and mark the room as active
      await db.query(
        `UPDATE battleship_game_sessions 
         SET opponent_id = $1, status = 'active' 
         WHERE room_id = $2`,
        [opponentId, roomId]
      );

      // Join the websocket channel
      socket.join(roomId);

      // Broadcast an initialization trigger to BOTH players in this room
      io.to(roomId).emit('match_started', {
        roomId: roomId,
        message: `Match initiated! Battle stations ready.`
      });

      console.log(`⚔️ Match Started: Room ${roomId} is now ACTIVE.`);

      // Update the lounge lobby listing for everyone else online
      await broadcastOpenLobbies();

    } catch (err) {
      console.error("Match link failure:", err);
      socket.emit('error_message', { message: 'Database error linking match session.' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});