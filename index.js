"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable require-jsdoc */
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const client_1 = require("@prisma/client");
require("dotenv").config();
const supabase_js_1 = require("@supabase/supabase-js");
const tiny_invariant_1 = __importDefault(require("tiny-invariant"));
(0, tiny_invariant_1.default)(process.env.SUPABASE_URL, "Missing env var: SUPABASE_URL");
(0, tiny_invariant_1.default)(process.env.SUPABASE_ANON_KEY, "Missing env var: SUPABASE_ANON_KEY");
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
// App setup
const PORT = 8080;
const app = (0, express_1.default)();
const server = app.listen(PORT, function () {
    console.log(`Listening on port ${PORT}`);
    console.log(`http://localhost:${PORT}`);
});
const prisma = new client_1.PrismaClient();
app.use((0, cors_1.default)());
app.use(express_1.default.static("public"));
app.use(express_1.default.json());
let libraryData;
let searchTrackData;
let recommendedRadios;
let customRadioStations;
const io = require("socket.io")(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
    allowEIO3: true,
});
function getSavedToLibrary(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const savedTracks = yield prisma.savedTrack.findMany({
            where: {
                userId: userId,
            },
        });
        return savedTracks;
    });
}
function getLibraryData(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const savedTracks = yield getSavedToLibrary(userId);
        const libraryData = yield prisma.track.findMany({
            where: {
                id: {
                    in: savedTracks.map((track) => track.trackId),
                },
            },
        });
        return libraryData;
    });
}
function getTrackSource(trackId) {
    return __awaiter(this, void 0, void 0, function* () {
        const trackSource = yield prisma.track.findUnique({
            where: {
                id: trackId,
            },
        });
        (0, tiny_invariant_1.default)(trackSource, "Track source not found");
        const { data, error } = yield supabase.storage
            .from("audio-center-music")
            .download(trackSource.url);
        if (error) {
            console.log(error);
        }
        return data;
    });
}
function saveToLibrary(trackId, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        return prisma.savedTrack.create({
            data: {
                userId: userId,
                trackId: trackId,
            },
        });
    });
}
function removeFromLibrary(trackId, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        return prisma.savedTrack.deleteMany({
            where: {
                trackId: trackId,
                userId: userId,
            },
        });
    });
}
function getCustomRadios(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const customRadios = yield prisma.savedRadioStation.findMany({
            where: {
                userId: userId,
            },
        });
        return customRadios;
    });
}
function saveToCustomRadios(url, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        return prisma.savedRadioStation.create({
            data: {
                userId: userId,
                title: `Custom Radio ${customRadioStations.length + 1}`,
                url: url,
            },
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        searchTrackData = yield prisma.track.findMany();
        recommendedRadios = yield prisma.radioStation.findMany();
    });
}
main()
    .then(() => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma.$disconnect();
}))
    .catch((e) => __awaiter(void 0, void 0, void 0, function* () {
    console.error(e);
    yield prisma.$disconnect();
    process.exit(1);
}));
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
    socket.on("send-track-source", (trackData) => __awaiter(this, void 0, void 0, function* () {
        const trackSource = yield getTrackSource(trackData.id);
        (0, tiny_invariant_1.default)(trackSource, "Track source not found");
        const trackArray = yield trackSource.arrayBuffer();
        socket.emit("send-track", { id: trackData.id, source: trackArray });
    }));
    socket.on("save-to-library", (trackId, accessToken) => __awaiter(this, void 0, void 0, function* () {
        var _a;
        const user = yield supabase.auth.getUser(accessToken);
        const userId = (_a = user.data.user) === null || _a === void 0 ? void 0 : _a.id;
        (0, tiny_invariant_1.default)(userId, "User ID not found");
        if (libraryData.length !== 0) {
            const trackExists = libraryData.find((track) => {
                return track.id.includes(trackId, userId);
            });
            if (!trackExists) {
                yield saveToLibrary(trackId, userId);
                libraryData = yield getLibraryData(userId);
            }
            else {
                yield removeFromLibrary(trackId, userId);
                libraryData = yield getLibraryData(userId);
            }
        }
        else {
            yield saveToLibrary(trackId, userId);
            libraryData = yield getLibraryData(userId);
        }
    }));
    socket.on("get-now-playing-info", (trackId) => {
        const nowPlayingInfo = searchTrackData.find((track) => {
            return track.id.includes(trackId);
        });
        socket.emit("send-now-playing-info", nowPlayingInfo);
    });
    socket.on("add-custom-radio-station", (stationURL, accessToken) => __awaiter(this, void 0, void 0, function* () {
        var _b;
        const user = yield supabase.auth.getUser(accessToken);
        const userId = (_b = user.data.user) === null || _b === void 0 ? void 0 : _b.id;
        (0, tiny_invariant_1.default)(userId, "User ID not found");
        yield saveToCustomRadios(stationURL, userId);
        customRadioStations = yield getCustomRadios(userId);
        socket.emit("get-custom-radio-stations", customRadioStations);
    }));
    socket.on("started-broadcast", (listeningStream, broadcastRoom) => {
        socket
            .to(broadcastRoom)
            .emit("listen-to-current-broadcast", listeningStream);
    });
    socket.on("join-broadcast-room", (broadcastRoomId, userSocketId) => {
        io.of("/").sockets.get(userSocketId).join(broadcastRoomId);
        console.log("User " + userSocketId + " joined broadcast room: " + broadcastRoomId);
    });
    socket.on("publish-broadcast-session-room", (broadcastRoomId) => {
        console.log("publish room");
        console.log(broadcastRoomId);
        socket.rooms;
        socket.broadcast.emit("broadcast-session-room", broadcastRoomId);
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
    (0, tiny_invariant_1.default)(req.headers.authorization, "Authorization header not found");
    const accessToken = req.headers.authorization.split(" ")[1];
    supabase.auth.getUser(accessToken).then((user) => {
        if (user.error) {
            res.status(401).send("Unauthorized");
        }
        else {
            res.send(libraryData);
        }
    });
});
app.get("/radio", (req, res) => {
    (0, tiny_invariant_1.default)(req.headers.authorization, "Authorization header not found");
    const accessToken = req.headers.authorization.split(" ")[1];
    supabase.auth.getUser(accessToken).then((user) => {
        if (user.error) {
            res.status(401).send("Unauthorized");
        }
        else {
            res.send(recommendedRadios);
        }
    });
});
app.get("/broadcast", (req, res) => {
    console.log(io.of("/").adapter.rooms);
    res.send(io.of("/").adapter.rooms);
});
