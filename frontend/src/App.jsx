// frontend/src/App.jsx
import { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import axios from 'axios';
import { io } from 'socket.io-client'; // Import the client socket engine
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  const [userSession, setUserSession] = useState(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const socketRef = useRef(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    if (userSession) {
      socketRef.current = io(API_URL);

      socketRef.current.emit('join_lobby', { playerName: userSession.name });

      return () => {
        if (socketRef.current) {
          socketRef.current.disconnect();
          console.log('🔌 Disconnected from websocket pipeline safely.');
        }
      };
    }
  }, [userSession, API_URL]);

  useEffect(() => {
    const savedToken = localStorage.getItem('battleship_session');
    const savedName = localStorage.getItem('battleship_name');
    if (savedToken && savedName) {
      setUserSession({ token: savedToken, name: savedName });
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!usernameInput.trim()) return;

    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await axios.post(`${API_URL}/api/users/login`, {
        username: usernameInput
      });
      const { sessionToken, displayName } = response.data;

      localStorage.setItem('battleship_session', sessionToken);
      localStorage.setItem('battleship_name', displayName);

      setUserSession({ token: sessionToken, name: displayName });
    } catch (err) {
      console.error(err);
      setErrorMessage(err.response?.data?.error || 'Unable to connect to the game server.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    setUserSession(null);
    setUsernameInput('');
  };

  if (userSession) {
    return (
      <Container className="py-5 text-center">
        <Row className="justify-content-center">
          <Col md={6}>
            <h1 className="display-5 mb-3 fw-bold text-dark">⚓ Battleship Fleet Command</h1>
            <p className="text-muted mb-4">Welcome back, <span className="fw-bold text-primary">{userSession.name}</span></p>
            <Card className="border-0 shadow-sm p-4 bg-light text-start mb-4">
              <Card.Body>
                <h5 className="fw-bold">Matchmaking Lounge</h5>
                <p className="text-muted small">Real-time socket line is now established. You can view connections in your backend console log output stream terminal.</p>
              </Card.Body>
            </Card>
            <Button variant="outline-danger" size="sm" onClick={handleLogout}>
              Change Identity
            </Button>
          </Col>
        </Row>
      </Container>
    );
  }

  return (
    <Container className="py-5" style={{ marginTop: '5rem' }}>
      <Row className="justify-content-center">
        <Col md={5}>
          <div className="text-center mb-4">
            <h1 className="fw-black text-dark mb-2" style={{ letterSpacing: '-0.05em' }}>BATTLESHIP</h1>
            <p className="text-secondary small text-uppercase tracking-wider">Remote Real-Time Multiplayer Platform</p>
          </div>
          <Card className="border shadow-sm p-4 bg-white">
            <Card.Body>
              <h5 className="fw-bold text-dark mb-3">Enter Player Identity</h5>
              <p className="text-muted small mb-4">No registration required. Choose a baseline handle below.</p>
              {errorMessage && <Alert variant="danger" className="py-2 small">{errorMessage}</Alert>}
              <Form onSubmit={handleLogin}>
                <Form.Group className="mb-4" controlId="formPlayerName">
                  <Form.Label className="small fw-semibold text-secondary">Username or Call Sign</Form.Label>
                  <Form.Control 
                    type="text" 
                    placeholder="e.g., Maverick" 
                    size="lg"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    disabled={isLoading}
                    maxLength={20}
                    required
                  />
                </Form.Group>
                <Button variant="primary" type="submit" className="w-100 py-2 fw-semibold" disabled={isLoading || !usernameInput.trim()}>
                  {isLoading ? 'Verifying Identity...' : 'Enter Fleet Command'}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default App;