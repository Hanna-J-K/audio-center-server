const express = require("express");
const cors = require("cors");
const fs = require("fs");

// App setup
const PORT = 3000;
const app = express();
const server = app.listen(PORT, function () {
  console.log(`Listening on port ${PORT}`);
  console.log(`http://localhost:${PORT}`);
});

app.use(cors());
app.use(express.static("public"));

const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  allowEIO3: true,
});

const searchTrackData = [
  { title: "Cry For Me", artist: "Twice", album: "Cry For Me" },
  {
    title: "Dance The Night Away",
    artist: "Twice",
    album: "Dance The Night Away",
  },
  { title: "Feel Special", artist: "Twice", album: "Feel Special" },
  { title: "Fancy", artist: "Twice", album: "Fancy" },
  { title: "Heart Shaker", artist: "Twice", album: "Heart Shaker" },
  { title: "Likey", artist: "Twice", album: "Likey" },
  { title: "Like Ooh-Ahh", artist: "Twice", album: "Like Ooh-Ahh" },
  { title: "Signal", artist: "Twice", album: "Signal" },
  { title: "TT", artist: "Twice", album: "TT" },
  { title: "What Is Love", artist: "Twice", album: "What Is Love" },
  { title: "Yes Or Yes", artist: "Twice", album: "Yes Or Yes" },
  { title: "Cheer Up", artist: "Twice", album: "Cheer Up" },
  { title: "Knock Knock", artist: "Twice", album: "Knock Knock" },
  { title: "Merry & Happy", artist: "Twice", album: "Merry & Happy" },
  { title: "One More Time", artist: "Twice", album: "One More Time" },
  { title: "OOH-AHH하게", artist: "Twice", album: "OOH-AHH하게" },
  { title: "SIGNAL", artist: "Twice", album: "SIGNAL" },
  { title: "TT", artist: "Twice", album: "TT" },
  { title: "Yes Or Yes", artist: "Twice", album: "Yes Or Yes" },
  { title: "DDU-DU-DDU-DU", artist: "Blackpink", album: "Square Uo" },
  { title: "Kill This Love", artist: "Blackpink", album: "Kill This Love" },
  {
    title: "How You Like That",
    artist: "Blackpink",
    album: "How You Like That",
  },
  { title: "Ice Cream", artist: "Blackpink", album: "Ice Cream" },
  { title: "Icy", artist: "ITZY", album: "Icy" },
  { title: "ICY", artist: "ITZY", album: "ICY" },
  { title: "Dalla Dalla", artist: "ITZY", album: "Dalla Dalla" },
  { title: "Not Shy", artist: "ITZY", album: "Not Shy" },
  { title: "Wannabe", artist: "ITZY", album: "Wannabe" },
  { title: "HIP", artist: "Mamamoo", album: "HIP" },
  { title: "Egotistic", artist: "Mamamoo", album: "Egotistic" },
  { title: "Starry Night", artist: "Mamamoo", album: "Starry Night" },
  { title: "Wind Flower", artist: "Mamamoo", album: "Wind Flower" },
];

io.engine.on("connection_error", (err) => {
  console.log(err);
});

io.on("connection", function (socket) {
  console.log("Established socket connection");
  console.log("User connected: " + socket.id);
  socket.on("get-track-list", () => {
    socket.emit("send-track-list", searchTrackData);
  });

  socket.on("search-for-track", (title) => {
    const result = searchTrackData.find((track) => {
      return track.title.toLowerCase().includes(title.toLowerCase());
    });
    console.log(result);
    console.log(typeof result);
    socket.broadcast.emit("send-track-info", result);
  });

  socket.on("send_message_to_server", (data) => {
    console.log(data);
    socket.broadcast.emit("broadcast_message", data);
  });
  socket.on("play_music", (data) => {
    console.log("halkoooo");
    console.log(data.filename);
    let filename;
    if (data.filename != "") {
      filename = __dirname + "/public/" + data.filename + ".mp3";
    } else {
      filename = __dirname + "/public/" + "cry.mp3";
    }
    // ss(socket).emit('play-song', stream, { name: filename });

    const trackArray = fs.readFileSync(filename).buffer;

    socket.emit(
      "send-song",
      trackArray,
      { name: filename },
      { type: "audio/mpeg" }
    );
  });

  socket.emit("set-client-id", socket.id);

  socket.on("call-user", ({ userToCall, from, name }) => {
    io.to(userToCall).emit("call-user", { from, name });
  });

  socket.on("answer-call", (data) => {
    io.to(data.to).emit("call-accepted", data.signal);
  });
});
