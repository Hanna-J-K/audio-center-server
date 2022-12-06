/* eslint-disable require-jsdoc */
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { PrismaClient } = require("@prisma/client");

// App setup
const PORT = 8080;
const app = express();
const server = app.listen(PORT, function () {
  console.log(`Listening on port ${PORT}`);
  console.log(`http://localhost:${PORT}`);
});
const prisma = new PrismaClient();

app.use(cors());
app.use(express.static("public"));
app.use(express.json());

const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  allowEIO3: true,
});

async function main() {
  // const allUsers = await prisma.user.findMany();
  // console.log(allUsers);
}

// async function findUserByEmail(email) {
//   const user = await prisma.user.findUnique({
//     where: {
//       email: email,
//     },
//   });
//   return user;
// }

// async function registerNewUser(email, username, password) {
//   const user = await prisma.user.create({
//     data: {
//       email: email,
//       username: username,
//       password: password,
//     },
//   });
//   return user;
// }

// async function getAllUsers() {
//   const allUsers = await prisma.user.findMany();
//   return allUsers;
// }

main()
  .then(async () => {
    await prisma.$disconnect();
  })

  .catch(async (e) => {
    console.error(e);

    await prisma.$disconnect();

    process.exit(1);
  });

const searchTrackData = [];
const pathTrackData = [];
// const pathToMusicDirectory = __dirname + "/public/music/";
// const pathToBroadcastsDirectory = __dirname + "/public/broadcasts/";
const libraryData = [];
const recommendedRadios = [
  {
    id: uuidv4(),
    name: "TokFM",
    url: "https://radiostream.pl/tuba10-1.mp3",
  },
  {
    id: uuidv4(),
    name: "RMF FM",
    url: "http://195.150.20.242:8000/rmf_fm",
  },
];
const customRadios = [];
const recommendedBroadcasts = [];
const customBroadcasts = [];

let trackFilename = "";

// fs.readdirSync(pathToMusicDirectory, { withFileTypes: true })
//   .filter((itemArtist) => itemArtist.isDirectory())
//   .forEach((artistDirectory) => {
//     fs.readdirSync(pathToMusicDirectory + artistDirectory.name + "/", {
//       withFileTypes: true,
//     })
//       .filter((itemAlbum) => itemAlbum.isDirectory())
//       .forEach((albumDirectory) => {
//         fs.readdirSync(
//           pathToMusicDirectory +
//             artistDirectory.name +
//             "/" +
//             albumDirectory.name +
//             "/",
//           { withFileTypes: true }
//         )
//           .filter((itemTrack) => itemTrack.isFile())
//           .forEach((trackFile) => {
//             const trackData = {
//               id: uuidv4(),
//               title: trackFile.name.replace(".mp3", ""),
//               artist: artistDirectory.name,
//               album: albumDirectory.name,
//             };
//             const trackPaths = {
//               id: trackData.id,
//               path:
//                 pathToMusicDirectory +
//                 artistDirectory.name +
//                 "/" +
//                 albumDirectory.name +
//                 "/" +
//                 trackFile.name,
//             };
//             searchTrackData.push(trackData);
//             pathTrackData.push(trackPaths);
//           });
//       });
//   });

io.engine.on("connection_error", (err) => {
  console.log(err);
});

io.on("connection", function (socket) {
  console.log("Established socket connection");
  console.log("User connected: " + socket.id);
  socket.on("get-track-list", () => {
    socket.emit("send-track-list", searchTrackData);
  });

  socket.on("search-for-track", (trackData) => {
    const trackInfo = searchTrackData.find((track) => {
      return track.id.includes(trackData.id);
    });
    socket.emit("send-track-info", trackInfo);

    if (trackData.id) {
      trackFile = pathTrackData.find((track) => {
        if (track.id.includes(trackData.id)) {
          return track.id.includes(trackData.id);
        }
      });
    }
  });

  socket.on("send-track-source", (trackData) => {
    const trackSource = pathTrackData.find((track) => {
      return track.id.includes(trackData.id);
    });

    trackFilename = trackSource.path;
    const trackArray = fs.readFileSync(trackFilename).buffer;
    socket.emit("send-track", { id: trackData.id, source: trackArray });
  });
  let savedTrackInfo = [];
  socket.on("save-to-library", (trackId) => {
    if (libraryData.length !== 0) {
      if (libraryData.find((track) => track.id.includes(trackId))) {
        const index = libraryData.findIndex((track) =>
          track.id.includes(trackId)
        );
        libraryData.splice(index, 1);
      } else {
        savedTrackInfo = searchTrackData.find((track) => {
          return track.id.includes(trackId);
        });
        libraryData.push(savedTrackInfo);
      }
    } else {
      savedTrackInfo = searchTrackData.find((track) => {
        return track.id.includes(trackId);
      });
      libraryData.push(savedTrackInfo);
    }
  });

  socket.on("get-now-playing-info", (trackId) => {
    const nowPlayingInfo = searchTrackData.find((track) => {
      return track.id.includes(trackId);
    });
    socket.emit("send-now-playing-info", nowPlayingInfo);
  });

  socket.on("add-custom-radio-station", (stationURL) => {
    customRadios.push({
      id: uuidv4(),
      name: "Custom Radio " + `${customRadios.length + 1}`,
      url: stationURL,
    });
    socket.emit("get-custom-radio-stations", customRadios);
  });

  socket.on("started-broadcast", (listeningStream, broadcastRoom) => {
    socket
      .to(broadcastRoom)
      .emit("listen-to-current-broadcast", listeningStream);
  });

  socket.on("join-broadcast-room", (broadcastRoomId, userSocketId) => {
    io.of("/").sockets.get(userSocketId).join(broadcastRoomId);
    console.log(
      "User " + userSocketId + " joined broadcast room: " + broadcastRoomId
    );
  });

  socket.on("upload-custom-broadcast", (data) => {
    const occurencesFromSameSession = customBroadcasts.filter(
      (broadcast) => broadcast.title === data.title
    );
    if (occurencesFromSameSession.length > 0) {
      customBroadcasts.push({
        id: data.id,
        title: data.title + ` (${occurencesFromSameSession.length})`,
        artist: data.artist,
        url: data.url,
      });
    } else {
      customBroadcasts.push(data);
    }

    console.log(customBroadcasts);
    socket.emit("get-custom-broadcasts", customBroadcasts);
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

  socket.on("disconnect", () => {
    console.log("User disconnected: " + socket.id);
  });
});

app.get("/library", (req, res) => {
  res.send(libraryData);
});

app.get("/radio", (req, res) => {
  res.send(recommendedRadios);
});

app.get("/broadcast", (req, res) => {
  res.send(recommendedBroadcasts);
});
