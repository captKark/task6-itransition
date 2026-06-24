// backend/index.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// The Test Route
app.get('/api/health', (req, res) => {
  res.json({ status: "healthy", message: "Backend is connected to the internet!" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});