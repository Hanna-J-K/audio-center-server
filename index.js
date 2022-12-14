/* eslint-disable require-jsdoc */
const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const invariant = require("tiny-invariant");

invariant(process.env.SUPABASE_URL, "Missing env var: SUPABASE_URL");
invariant(process.env.SUPABASE_ANON_KEY, "Missing env var: SUPABASE_ANON_KEY");

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
let recommendedRadios = [];
let customRadioStations = [];
let liveBroadcasts = [];

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

async function getTrackSource(trackId) {
  const trackSource = await prisma.track.findUnique({
    where: {
      id: trackId,
    },
  });

  invariant(trackSource, "Track source not found");

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

async function getCustomRadios(userId) {
  const customRadios = await prisma.savedRadioStation.findMany({
    where: {
      userId: userId,
    },
  });
  return customRadios;
}

async function saveToCustomRadios(url, userId) {
  return prisma.savedRadioStation.create({
    data: {
      userId: userId,
      title: `Custom Radio ${customRadioStations.length + 1}`,
      url: url,
    },
  });
}

async function main() {
  searchTrackData = await prisma.track.findMany();
  recommendedRadios = await prisma.radioStation.findMany();
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
    invariant(trackSource, "Track source not found");
    const trackArray = await trackSource.arrayBuffer();
    socket.emit("send-track", { id: trackData.id, source: trackArray });
  });
  socket.on("save-to-library", async (trackId, accessToken) => {
    const user = await supabase.auth.getUser(accessToken);
    const userId = user.data.user?.id;
    invariant(userId, "User ID not found");
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

  socket.on("add-custom-radio-station", async (stationURL, accessToken) => {
    const user = await supabase.auth.getUser(accessToken);
    const userId = user.data.user?.id;
    invariant(userId, "User ID not found");
    await saveToCustomRadios(stationURL, userId);
    customRadioStations = await getCustomRadios(userId);
    socket.emit("get-custom-radio-stations", customRadioStations);
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

  socket.on("leave-broadcast-room", (broadcastRoomId, userSocketId) => {
    io.of("/").sockets.get(userSocketId).leave(broadcastRoomId);
    console.log(
      "User " + userSocketId + " left broadcast room: " + broadcastRoomId
    );
  });

  socket.on("publish-broadcast-session-room", (broadcastSessionData) => {
    console.log(
      "Broadcast room " + broadcastSessionData.room + " has been published"
    );
    liveBroadcasts.push(broadcastSessionData);
  });

  socket.on("stop-broadcast-session-room", async (broadcastSessionData) => {
    console.log(
      "Broadcast room " + broadcastSessionData.room + " has been stopped"
    );
    liveBroadcasts = liveBroadcasts.filter((broadcastSession) => {
      return broadcastSession.room !== broadcastSessionData.room;
    });
    const roomClients = await io.in(broadcastSessionData.room).fetchSockets();
    roomClients.forEach((client) => {
      client.leave(broadcastSessionData.room);
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

  socket.on("disconnect", () => {
    console.log("User disconnected: " + socket.id);
  });
});

app.get("/library", (req, res) => {
  invariant(req.headers.authorization, "Authorization header not found");
  const accessToken = req.headers.authorization.split(" ")[1];
  supabase.auth.getUser(accessToken).then((user) => {
    if (user.error) {
      res.status(401).send("Unauthorized");
    } else {
      res.send(libraryData);
    }
  });
});

app.get("/radio", (req, res) => {
  invariant(req.headers.authorization, "Authorization header not found");
  const accessToken = req.headers.authorization.split(" ")[1];
  supabase.auth.getUser(accessToken).then((user) => {
    if (user.error) {
      res.status(401).send("Unauthorized");
    } else {
      res.send(recommendedRadios);
    }
  });
});

app.get("/broadcast", (req, res) => {
  invariant(req.headers.authorization, "Authorization header not found");
  const accessToken = req.headers.authorization.split(" ")[1];
  supabase.auth.getUser(accessToken).then((user) => {
    if (user.error) {
      res.status(401).send("Unauthorized");
    } else {
      res.send(liveBroadcasts);
    }
  });
});
