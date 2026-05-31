# PEAK PY – Social World

A real-time 2D multiplayer social game built with Flask, SocketIO, and HTML Canvas. Move around, chat with others, send images, and build simple maps.

## Features

- **Multiplayer rooms** – create a room (become host) or join by code
- **Real-time movement** – WASD controls, smooth position sync via WebSockets
- **Colored avatars** – unique color per player, name shown above avatar
- **Chat system** – text messages + image URLs; messages appear in chat log and as speech bubbles above players (3-second duration)
- **Build mode** (host only) – place/remove colored blocks on a grid
- **Dark UI** – modern dark theme, responsive layout

## How to Run

1. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

2. Start the server:
   ```
   python app.py
   ```

3. Open `http://localhost:5000` in your browser. Open a second tab to test multiplayer.

## Controls

| Key | Action |
|---|---|
| WASD / Arrow keys | Move your avatar |
| Chat input + Enter | Send text message |
| Image URL input + Img | Send image (URL) |
| Build tools (host) | Toggle build mode, place/remove blocks |

## Architecture

```
┌──────────┐   WebSocket (SocketIO)   ┌──────────────┐
│ Browser  │ ◄──────────────────────► │ Flask Server │
│ Canvas   │                          │              │
│ Game.js  │                          │ game_state   │
└──────────┘                          └──────────────┘
```

- **Flask** serves the HTML page
- **Flask-SocketIO** handles real-time communication (player movement, chat, block placement)
- **game_state.py** holds all room/player/block data in memory
- **game.js** manages the client-side game loop: rendering, input, and WebSocket sync
- **No database** – all state is ephemeral (lost on server restart)

## Project Structure

```
PEAK_PY/
├── app.py              # Flask + SocketIO server
├── game_state.py       # In-memory game state
├── requirements.txt
├── static/
│   ├── style.css
│   └── game.js
├── templates/
│   └── index.html
└── README.md
```
