const express = require('express')
const cors = require('cors');
const ss = require('socket.io-stream');
const fs = require('fs');

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
    methods: ["GET", "POST"]
  },
  allowEIO3: true
});

const activeUsers = new Set();
const trackListData = [
  'cry',
  'Not Rickroll',
]  

io.engine.on("connection_error", (err) => {
    console.log(err);
  });

io.on("connection", function (socket) {
  console.log("Established socket connection");
  console.log("User connected: " + socket.id);
  socket.emit('track-list', trackListData)

  socket.on('send_message_to_server', (data) => {
    console.log(data);
    socket.broadcast.emit('broadcast_message', data);
  });

  socket.emit('track-list', trackListData);

  socket.on('play_music', (data) => {
    console.log('halkoooo')
    console.log(data.filename)
    var filename;
    if (data.filename != '') {
      filename = __dirname + '/public/' + data.filename + '.mp3';
    } else {
      filename = __dirname + '/public/' + 'cry.mp3';
    }
    // ss(socket).emit('play-song', stream, { name: filename });

    const trackArray = fs.readFileSync(filename).buffer;
    console.log(filename)
    console.log()
    console.log(typeof trackArray)
    console.log(trackArray instanceof ArrayBuffer)

    socket.emit('play-song', trackArray, { name: filename }, {type: 'audio/mpeg'});
  });

  socket.emit("set-client-id", socket.id);

  socket.on("call-user", ({ userToCall, from, name }) => {
		io.to(userToCall).emit("call-user", { from, name });
	});

	socket.on("answer-call", (data) => {
		io.to(data.to).emit("call-accepted", data.signal)
	});
});