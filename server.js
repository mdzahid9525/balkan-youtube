const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

app.get("/", (req, res) => {
  res.json({
    name: "BalkanYouTube Backend",
    status: "online"
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const rooms = new Map();

function createRoomCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("create-room", (callback) => {
    let code;

    do {
      code = createRoomCode();
    } while (rooms.has(code));

    rooms.set(code, {
      members: new Set([socket.id]),
      state: {
        playing: false,
        position: 0,
        updatedAt: Date.now()
      }
    });

    socket.join(code);

    if (typeof callback === "function") {
      callback({ ok: true, roomCode: code });
    }
  });

  socket.on("join-room", (data, callback) => {
    const code = String(data?.roomCode || "");
    const room = rooms.get(code);

    if (!room) {
      if (typeof callback === "function") {
        callback({ ok: false, error: "Room not found" });
      }
      return;
    }

    room.members.add(socket.id);
    socket.join(code);

    if (typeof callback === "function") {
      callback({ ok: true, state: room.state });
    }

    socket.to(code).emit("member-joined");
  });

  socket.on("playback-update", (data) => {
    const code = String(data?.roomCode || "");
    const room = rooms.get(code);

    if (!room || !room.members.has(socket.id)) return;

    room.state = {
      playing: Boolean(data.playing),
      position: Math.max(0, Number(data.position) || 0),
      updatedAt: Date.now()
    };

    socket.to(code).emit("playback-update", room.state);
  });

  socket.on("disconnect", () => {
    for (const [code, room] of rooms) {
      room.members.delete(socket.id);

      if (room.members.size === 0) {
        rooms.delete(code);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`BalkanYouTube backend listening on ${PORT}`);
});
