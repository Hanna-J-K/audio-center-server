const express = require("express");
const cors = require("cors");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

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

const searchTrackData = [];
const pathTrackData = [];
const pathToDirectory = __dirname + "/public/music/";

fs.readdirSync(pathToDirectory, { withFileTypes: true })
  .filter((itemArtist) => itemArtist.isDirectory())
  .forEach((artistDirectory) => {
    fs.readdirSync(pathToDirectory + artistDirectory.name + "/", {
      withFileTypes: true,
    })
      .filter((itemAlbum) => itemAlbum.isDirectory())
      .forEach((albumDirectory) => {
        fs.readdirSync(
          pathToDirectory +
            artistDirectory.name +
            "/" +
            albumDirectory.name +
            "/",
          { withFileTypes: true }
        )
          .filter((itemTrack) => itemTrack.isFile())
          .forEach((trackFile) => {
            const trackData = {
              id: uuidv4(),
              title: trackFile.name.replace(".mp3", ""),
              artist: artistDirectory.name,
              album: albumDirectory.name,
            };
            const trackPaths = {
              id: trackData.id,
              path:
                pathToDirectory +
                artistDirectory.name +
                "/" +
                albumDirectory.name +
                "/" +
                trackFile.name,
            };
            searchTrackData.push(trackData);
            pathTrackData.push(trackPaths);
          });
      });
  });

io.engine.on("connection_error", (err) => {
  console.log(err);
});

io.on("connection", function (socket) {
  console.log("Established socket connection");
  console.log("User connected: " + socket.id);
  socket.on("get-track-list", () => {
    socket.emit("send-track-list", searchTrackData);
  });

  socket.on("search-for-track", (trackId) => {
    const trackInfo = searchTrackData.find((track) => {
      return track.id.includes(trackId);
    });
    socket.emit("send-track-info", trackInfo);

    let trackFilename = "";
    if (trackId) {
      trackFile = pathTrackData.find((track) => {
        if (track.id.includes(trackId)) {
          return track.id.includes(trackId);
        }
      });
    }
    trackFilename = trackFile.path;

    const trackArray = fs.readFileSync(trackFilename).buffer;
    socket.emit("send-song", {
      trackArray,
      trackFilename,
      id: trackFile.id,
    });
  });

  socket.on("send_message_to_server", (data) => {
    console.log(data);
    socket.broadcast.emit("broadcast_message", data);
  });

  socket.emit("set-client-id", socket.id);

  socket.on("call-user", ({ userToCall, from, name }) => {
    io.to(userToCall).emit("call-user", { from, name });
  });

  socket.on("answer-call", (data) => {
    io.to(data.to).emit("call-accepted", data.signal);
  });
});
