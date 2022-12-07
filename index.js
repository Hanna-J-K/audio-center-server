/* eslint-disable require-jsdoc */
const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const { PrismaClient } = require("@prisma/client");
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

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

let libraryData = [];
let searchTrackData = [];

const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  allowEIO3: true,
});

async function getSavedToLibrary(userId) {
  const savedTracks = await prisma.savedTrack.findMany({
    where: {
      userId: userId,
    },
  });
  return savedTracks;
}

async function getLibraryData(userId) {
  const savedTracks = await getSavedToLibrary(userId);
  const libraryData = await prisma.track.findMany({
    where: {
      id: {
        in: savedTracks.map((track) => track.trackId),
      },
    },
  });
  return libraryData;
}

async function main() {
  searchTrackData = await prisma.track.findMany();
  libraryData = await getLibraryData();
}

async function getTrackSource(trackId) {
  const trackSource = await prisma.track.findUnique({
    where: {
      id: trackId,
    },
  });

  const { data, error } = await supabase.storage
    .from("audio-center-music")
    .download(trackSource.url);

  if (error) {
    console.log(error);
  }
  return data;
}

async function saveToLibrary(trackId, userId) {
  return prisma.savedTrack.create({
    data: {
      userId: userId,
      trackId: trackId,
    },
  });
}

async function removeFromLibrary(trackId, userId) {
  return prisma.savedTrack.deleteMany({
    where: {
      trackId: trackId,
      userId: userId,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })

  .catch(async (e) => {
    console.error(e);

    await prisma.$disconnect();

    process.exit(1);
  });

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
  });

  socket.on("send-track-source", async (trackData) => {
    const trackSource = await getTrackSource(trackData.id);
    const trackArray = await trackSource.arrayBuffer();
    socket.emit("send-track", { id: trackData.id, source: trackArray });
  });
  socket.on("save-to-library", async (trackId, accessToken) => {
    console.log(accessToken);
    const user = await supabase.auth.getUser(accessToken);
    console.log(user);
    const userId = user.data.user.id;
    console.log(userId);
    if (libraryData.length !== 0) {
      const trackExists = libraryData.find((track) => {
        return track.id.includes(trackId, userId);
      });
      if (!trackExists) {
        await saveToLibrary(trackId, userId);
        libraryData = await getLibraryData(userId);
      } else {
        await removeFromLibrary(trackId, userId);
        libraryData = await getLibraryData(userId);
      }
    } else {
      await saveToLibrary(trackId, userId);
      libraryData = await getLibraryData(userId);
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
  // eslint-disable-next-line camelcase
  const access_token = req.headers.authorization.split(" ")[1];
  supabase.auth.getUser(access_token).then((user) => {
    if (user.error) {
      res.status(401).send("Unauthorized");
    } else {
      res.send(libraryData);
    }
  });
});

app.get("/radio", (req, res) => {
  res.send(recommendedRadios);
});

app.get("/broadcast", (req, res) => {
  res.send(recommendedBroadcasts);
});
