// frontend/src/App.jsx
import { useEffect, useState } from 'react';
import axios from 'axios';

function App() {
  const [statusMessage, setStatusMessage] = useState("Connecting to backend...");

  useEffect(() => {
    // Grabbing the API URL from environment variables
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    
    axios.get(`${apiUrl}/api/health`)
      .then((response) => {
        setStatusMessage(response.data.message);
      })
      .catch((error) => {
        console.error("Connection error:", error);
        setStatusMessage("Failed to connect to backend.");
      });
  }, []);

  return (
    <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>⚓ Battleship Task 6 Pipeline Test</h1>
      <div style={{ margin: '2rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h3>Backend Status:</h3>
        <p style={{ fontWeight: 'bold', color: statusMessage.includes('connected') ? 'green' : 'red' }}>
          {statusMessage}
        </p>
      </div>
    </div>
  );
}

export default App;