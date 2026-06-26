import { useState, useEffect, useRef } from "react";

import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Alert,
  Table,
  Badge,
} from "react-bootstrap";
import axios from "axios";
import { io } from "socket.io-client";
import "bootstrap/dist/css/bootstrap.min.css";

function App() {
  const [userSession, setUserSession] = useState(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [lobbies, setLobbies] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [gridSize, setGridSize] = useState(10);
  const [isMatchActive, setIsMatchActive] = useState(false);

  const socketRef = useRef(null);
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

  useEffect(() => {
    if (userSession) {
      socketRef.current = io(API_URL);

      socketRef.current.emit("join_lobby", { playerName: userSession.name });

      socketRef.current.on("lobby_list_updated", (updatedLobbies) => {
        setLobbies(updatedLobbies);
      });

      socketRef.current.on("room_created", (data) => {
        setCurrentRoom(data.roomId);
      });

      socketRef.current.on("match_started", (data) => {
        setCurrentRoom(data.roomId);
        setIsMatchActive(true); // Switch view mode to active game field
      });

      socketRef.current.on("error_message", (data) => {
        setErrorMessage(data.message);
      });

      return () => {
        if (socketRef.current) {
          socketRef.current.disconnect();
        }
      };
    }
  }, [userSession, API_URL]);

  // Check if a player session already exists when application loads
  useEffect(() => {
    const savedToken = localStorage.getItem("battleship_session");
    const savedName = localStorage.getItem("battleship_name");
    if (savedToken && savedName) {
      setUserSession({ token: savedToken, name: savedName });
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!usernameInput.trim()) return;

    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await axios.post(`${API_URL}/api/users/login`, {
        username: usernameInput,
      });
      const { sessionToken, displayName } = response.data;

      localStorage.setItem("battleship_session", sessionToken);
      localStorage.setItem("battleship_name", displayName);

      setUserSession({ token: sessionToken, name: displayName });
    } catch (err) {
      console.error(err);
      setErrorMessage(
        err.response?.data?.error || "Unable to connect to the game server.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (!socketRef.current || !userSession) return;

    const standardShips = [
      { type: "Carrier", size: 5, count: 1 },
      { type: "Battleship", size: 4, count: 1 },
      { type: "Destroyer", size: 3, count: 2 },
      { type: "Patrol Boat", size: 2, count: 1 },
    ];

    // Emit event up to the server engine
    socketRef.current.emit("create_room", {
      sessionToken: userSession.token,
      gridSize: parseInt(gridSize, 10),
      shipConfiguration: standardShips,
    });
  };

  const handleJoinRoom = (roomId) => {
    if (!socketRef.current || !userSession) return;

    socketRef.current.emit("join_room", {
      sessionToken: userSession.token,
      roomId: roomId,
    });
  };

  const handleLogout = () => {
    localStorage.clear();
    setUserSession(null);
    setUsernameInput("");
    setCurrentRoom(null);
    setLobbies([]);
    setIsMatchActive(false); // Reset
  };

  if (userSession) {
    // STATE 1: GAME BOARD IS RUNNING LIVED
    if (currentRoom && isMatchActive) {
      return (
        <Container className="py-5 text-center">
          <h2 className="fw-bold text-dark mb-1">🎯 Tactical Combat Grid</h2>
          <p className="text-muted small mb-4 font-monospace">
            Room Cluster ID: {currentRoom}
          </p>
          <div className="p-5 bg-dark text-white rounded shadow-sm">
            <h4>[ Battleship Battle Board Component Will Load Here ]</h4>
            <p className="text-secondary small mb-0">
              Prepare to deploy your fleet.
            </p>
          </div>
        </Container>
      );
    }

    // STATE 2: HOSTING AND WAITING FOR OPPONENT IN ROOM
    if (currentRoom && !isMatchActive) {
      return (
        <Container className="py-5">
          <Row className="justify-content-center">
            <Col md={8}>
              <Card className="border-primary shadow-sm text-center p-5 bg-white">
                <Card.Body>
                  <div
                    className="spinner-border text-primary mb-3"
                    role="status"
                  ></div>
                  <h4 className="fw-bold text-dark">Waiting for an Opponent</h4>
                  <p className="text-muted small mb-4">
                    Your match session has been broadcasted to the lounge
                    network.
                  </p>
                  <div className="bg-light p-3 rounded mb-4 text-start font-monospace small border">
                    <strong>ROOM ID:</strong> {currentRoom}
                  </div>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => {
                      setCurrentRoom(null);
                      setIsMatchActive(false);
                    }}
                  >
                    Cancel Matchmaking
                  </Button>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      );
    }

    // STATE 3: STANDARD MAIN MATCHMAKING LOUNGE LOBBY
    return (
      <Container className="py-5">
        <Row className="mb-4 align-items-center">
          <Col>
            <h2 className="fw-bold text-dark mb-1">⚓ Fleet Command Lounge</h2>
            <p className="text-muted small mb-0">
              Authenticated as:{" "}
              <span className="fw-semibold text-primary">
                {userSession.name}
              </span>
            </p>
          </Col>
          <Col className="text-end">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={handleLogout}
            >
              Disconnect Session
            </Button>
          </Col>
        </Row>

        {errorMessage && (
          <Alert variant="danger" className="py-2 small mb-4">
            {errorMessage}
          </Alert>
        )}

        <Row className="g-4">
          {/* Left Column: Create Custom Session Form */}
          <Col lg={4}>
            <Card className="border shadow-sm p-3 bg-white">
              <Card.Body>
                <h5 className="fw-bold text-dark mb-3">Host New Game</h5>
                <Form onSubmit={handleCreateRoom}>
                  <Form.Group className="mb-4">
                    <Form.Label className="small fw-semibold text-secondary">
                      Grid Dimension
                    </Form.Label>
                    <Form.Select
                      value={gridSize}
                      onChange={(e) => setGridSize(e.target.value)}
                      className="border-secondary-subtle"
                    >
                      <option value={10}>10 x 10 (Standard)</option>
                      <option value={12}>12 x 12 (Large)</option>
                      <option value={15}>15 x 15 (Warzone)</option>
                    </Form.Select>
                  </Form.Group>

                  <div className="mb-4">
                    <Form.Label className="small fw-semibold text-secondary d-block mb-2">
                      Fleet Layout (Standard)
                    </Form.Label>
                    <div className="bg-light p-2 rounded border small text-muted">
                      • 1x Carrier (5 slots)
                      <br />
                      • 1x Battleship (4 slots)
                      <br />
                      • 2x Destroyer (3 slots)
                      <br />• 1x Patrol Boat (2 slots)
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    type="submit"
                    className="w-100 py-2 fw-semibold"
                  >
                    Broadcast Open Room
                  </Button>
                </Form>
              </Card.Body>
            </Card>
          </Col>

          {/* Right Column: Real-Time Open Lobbies List */}
          <Col lg={8}>
            <Card className="border shadow-sm p-3 bg-white h-100">
              <Card.Body>
                <h5 className="fw-bold text-dark mb-3">
                  Active Engagements Channel
                </h5>

                {lobbies.length === 0 ? (
                  <div className="text-center py-5 border rounded bg-light text-muted small">
                    No open rooms found. Use the configuration panel to host a
                    new session.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <Table hover className="align-middle border-top-0 mb-0">
                      <thead>
                        <tr className="text-secondary small uppercase">
                          <th>Host Captain</th>
                          <th>Grid Size</th>
                          <th>Status</th>
                          <th className="text-end">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lobbies.map((room) => (
                          <tr key={room.room_id}>
                            <td className="fw-semibold text-dark">
                              {room.creator_name}
                            </td>
                            <td>
                              <Badge bg="secondary" className="fw-normal">
                                {room.grid_size} x {room.grid_size}
                              </Badge>
                            </td>
                            <td>
                              <Badge
                                bg="success"
                                className="px-2 py-1 fw-normal"
                              >
                                Waiting
                              </Badge>
                            </td>
                            <td className="text-end">
                              <Button
                                variant="outline-primary"
                                size="sm"
                                className="px-3 fw-medium"
                                onClick={() => handleJoinRoom(room.room_id)}
                              >
                                Join Engagement
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    );
  }

  return (
    <Container className="py-5" style={{ marginTop: "5rem" }}>
      <Row className="justify-content-center">
        <Col md={5}>
          <div className="text-center mb-4">
            <h1
              className="fw-black text-dark mb-2"
              style={{ letterSpacing: "-0.05em" }}
            >
              BATTLESHIP
            </h1>
            <p className="text-secondary small text-uppercase tracking-wider">
              Remote Real-Time Multiplayer Platform
            </p>
          </div>
          <Card className="border shadow-sm p-4 bg-white">
            <Card.Body>
              <h5 className="fw-bold text-dark mb-3">Enter Player Identity</h5>
              <p className="text-muted small mb-4">
                No registration required. Choose a baseline handle below.
              </p>
              {errorMessage && (
                <Alert variant="danger" className="py-2 small">
                  {errorMessage}
                </Alert>
              )}
              <Form onSubmit={handleLogin}>
                <Form.Group className="mb-4" controlId="formPlayerName">
                  <Form.Label className="small fw-semibold text-secondary">
                    Username or Call Sign
                  </Form.Label>
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
                <Button
                  variant="primary"
                  type="submit"
                  className="w-100 py-2 fw-semibold"
                  disabled={isLoading || !usernameInput.trim()}
                >
                  {isLoading ? "Verifying Identity..." : "Enter Fleet Command"}
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
