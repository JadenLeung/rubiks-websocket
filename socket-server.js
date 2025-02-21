const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { 
        origin: ["http://localhost:8000", "https://virtual-cube.net", "https://jadenleung.github.io"],
        methods: ["GET", "POST"]
    },
   transports: ["polling"] // Forces long polling instead of WebSockets
});

app.get("/", (req, res) => {
                  res.json({ message: "Hello World 5" });
});

app.use(cors());
app.use(express.static("public"));

let rooms = {};

io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on("restart-game", (room, data, cb) => {
        room = String(room);
        if (!rooms.hasOwnProperty(room)) {
            createRoom(data.data, data.names[socket.id], room)
        } else {
            console.log("attempting to join room already there restart")
            joinRoom(room, data.names[socket.id], cb);
        }
    })

    socket.on("create-room", (data, name, cb) => {
        createRoom(data, name, false);
    });

    function createRoom(data, name, setroom) {

        for (let i = Math.floor(Math.random() * 1000); true; i++) {
            if (setroom) {
                i = setroom;
            }
            if (rooms.hasOwnProperty(i)) {
                continue;
            }
            data.leader = socket.id;
            rooms[i] = { userids: [socket.id], names: {}, data: data, stage: "lobby", round: -1, solved: {}, 
                        winners: {}, solvedarr : [], progress: {}, times: {}, screenshots: {}};
            console.log(`${socket.id} is joining room ${i}. Rooms has info ${JSON.stringify(rooms)}`);
            rooms[i].names[socket.id] = name;
            socket.join(String(i));
            io.emit("room_change", rooms);
            io.to(String(i)).emit("refresh_rooms", rooms[i], i);
            socket.emit("joined_room", i, socket.id, name);
            break;
        }
    }
    socket.on("join-room", (room, name, failedcb) => {
        joinRoom(room, name, failedcb);
    });

    socket.on("get-rooms", () => {
        io.emit("room_change", rooms);
    })

    function joinRoom(room, name, failedcb) {
        room = String(room);
        console.log("Attempting to join room, data is ", rooms[room])
        if (rooms.hasOwnProperty(room)) {
            if (rooms[room].stage != "lobby") {
                failedcb("Game already started.");
            } else if (rooms[room].data.type == "1v1" && rooms[room].userids.length >= 2) {
                failedcb("Maximum capacity exceeded");
            } else {
                rooms[room].userids.push(socket.id);
                rooms[room].names[socket.id] = name;
                socket.join(String(room));
                console.log("Current rooms after joining", io.sockets.adapter.rooms, socket.id);
                io.emit("room_change", rooms);
                io.to(room).emit("refresh_rooms", rooms[room], room);
                io.to(room).emit("joined_room", room, socket.id, name);
                console.log(`${socket.id} joined room ${room}. Updated Data: ${JSON.stringify(rooms)}`);
            }
        } else {
            failedcb("Invalid room #");
        }
    }
    
    socket.on("leave-room", (room) => {
        room = String(room);
        if (room != 0) {
            socket.leave(room);
            removePlayer(socket.id)
        }
    });

    socket.on("start-match", (room) => {
        room = String(room);
        if (rooms.hasOwnProperty(room) && rooms[room].stage == "lobby") {
            rooms[room].stage = "ingame";
            rooms[room].round = 0;
            if (rooms[room].data.type == "teamblind") {
                console.log("Setting match")
                rooms[room].data.blinded = rooms[room].userids[1];
                rooms[room].data.time = 0;
                rooms[room].data.startblind = 0;
            }
            io.to(room).emit("started-match", rooms[room], getShuffle(rooms[room].data.dims[rooms[room].round]));
            io.emit("room_change", rooms);
        }
    });
    socket.on("solved", (room, time) => {
        room = String(room);
        console.log("Someone emitted solved",  rooms[room].stage);
        if (rooms.hasOwnProperty(room) && rooms[room].stage == "ingame") {
            rooms[room].solved[socket.id] = time;
            updateTimes(room);
            if (rooms.hasOwnProperty(room) && rooms[room].stage == "ingame") {
                rooms[room].solvedarr[rooms[room].round] = rooms[room].solved;
                console.log("Append solved", JSON.stringify(rooms[room].solvedarr));
            }
        }
    });
    socket.on("next-round", (room) => {
        room = String(room);
        console.log("Attempting next round");
        if (rooms.hasOwnProperty(room) && rooms[room].stage != "lobby") {
            console.log("Starting next round");
            rooms[room].stage = "ingame";
            rooms[room].round++;
            rooms[room].solved = {};
            rooms[room].progress = {};
            rooms[room].times = {};
            rooms[room].screenshots = {};
            io.to(room).emit("next-match", rooms[room], getShuffle(rooms[room].data.dims[rooms[room].round]));
            console.log(getShuffle(rooms[room].data.dims[rooms[room].round]));
        }
    });

    socket.on("progress-update", (room, progress, time, posid) => {
        room = String(room);
        if (rooms.hasOwnProperty(room) && rooms[room].stage == "ingame") {
            rooms[room].progress[socket.id] = progress;
            rooms[room].times[socket.id] = time;
            if (rooms[room].data.type == "teamblind" && socket.id == rooms[room].data.blinded) {
                rooms[room].data.time = time;
                rooms[room].data.posid = posid;
            }
            io.to(room).emit("update-data", rooms[room]);
        }
    });

    socket.on("send-message", (message, room, username, image = false) => {
        if (rooms.hasOwnProperty(room) && rooms[room].userids.length > 1) {
            if (image == true)
                console.log("sending image");
            io.to(room).emit("sending-message", message, socket.id, {[socket.id] : username, ...rooms[room].names}, image);
        } else {
            console.log("sending to one person");
            socket.emit("sending-message", message, socket.id, {[socket.id] : username}, image);
        }
    })

    socket.on("send-screenshot", (screenshot, op) => {
        io.to(op).emit("update-screenshot", screenshot);
    })

    function updateTimes(room) {
        room = String(room);
        if (rooms.hasOwnProperty(room) && rooms[room].stage != "lobby") {
            if (Object.keys(rooms[room].solved).length == rooms[room].userids.length) {
                let winningtime = "DNF";
                for (let id in rooms[room].solved) {
                    const thetime = rooms[room].solved[id];
                    if (thetime != "DNF") {
                        if (winningtime == "DNF" || thetime < winningtime) {
                            winningtime = thetime;
                        }
                    }
                }
                rooms[room].stage = "results";
                console.log(`WINNING TIME ${winningtime}`);
                rooms[room].userids.forEach((id) => {
                    if (rooms[room].solved[id] == winningtime) {
                        if (!rooms[room].winners[id]) {
                            rooms[room].winners[id] = 1;
                        } else {
                            rooms[room].winners[id]++;
                        }
                    }
                });
                rooms[room].solvedarr[rooms[room].round] = rooms[room].solved;
                rooms[room].data.blinded = "";
                console.log(`WINNER: ${JSON.stringify(rooms[room].winners)}`);
                io.to(room).emit("all-solved", rooms[room], rooms[room].winners);
                if (rooms[room].round + 1 == rooms[room].data.dims.length) {
                    delete rooms[room];
                    io.in(room).socketsLeave(room);
                    console.log("DELETING ROOM");
                }
            } else {
                io.to(room).emit("update-data", rooms[room]);
            }
        }
    }
    socket.on("giveup_blind", room => {
        rooms[room].data.blinded = "";
        rooms[room].stage = "results";
        rooms[room].data.time = "DNF";
        io.to(room).emit("all-solved", rooms[room], rooms[room].winners);
        delete rooms[room];
        io.in(room).socketsLeave(room);
    })
    socket.on("switch_blindfold", (room, blinded) => {
        rooms[room].data.blinded = blinded;
        rooms[room].data.startblind = rooms[room].data.time;
        io.to(room).emit("switched-blindfold", rooms[room]);
    })
    socket.on("disconnect", (reason) => {
        console.log(`User disconnected: ${socket.id}, Reason: ${reason}`);
        removePlayer(socket.id);
       
    });

    function removePlayer(player) {
        Object.keys(rooms).forEach((room) => {
            if (rooms[room].userids && rooms[room].userids.includes(player)) {
                for (let i = 0; rooms[room] && i < rooms[room].userids.length; ++i) {
                    if (player == rooms[room].userids[i]) {
                        io.to(room).emit("left_room", room, socket.id, rooms[room].names);
                        rooms[room].userids.splice(i, 1);
                        if (rooms[room].userids.length == 0) {
                            delete rooms[room];
                            io.emit("room_change", rooms);
                            return;
                        }
                        if (rooms[room].data.leader == player) {
                            rooms[room].data.leader = rooms[room].userids[0];
                        }
                        if (rooms[room].stage == "lobby") {
                            io.to(room).emit("refresh_rooms", rooms[room], room);
                        } else if (rooms[room].stage == "ingame") {
                            updateTimes(room);
                        } else if (rooms[room].stage == "results") {
                            io.to(room).emit("all-solved", rooms[room], rooms[room].winners);
                        }
                        io.emit("room_change", rooms);
                        console.log(`${player} is leaving the room ${room}. Data is ${JSON.stringify(rooms)}`);
                    }
                }
                console.log(`Deleted room ${room}. Rooms has info ${JSON.stringify(rooms)}`)
            }
        })
    }

    function shuffleCube(type, shufflenum) { 
        let arr = [];
        console.log("shuffling");
        let possible = ["R", "L", "U", "D", "B", "F", "Rw", "Lw", "Uw", "Dw", "Bw", "Fw"];
        let bad5 = ['L','R','F','B','S','M','l','r','f','b'];
        let doubly = false;
        if(type == "Middle Slices")
            possible = ["E", "M", "S"];
        else if(type == "Double Turns")
            doubly = true;

        let s = shufflenum;

        let total = "";
        for(let i = 0; i < s; i++)
        {
            let rnd = possible[Math.floor(Math.random() * possible.length)];
            let rnd2 = Math.random();
            if(doubly || ((type == "3x3x2" || (type == "2x2x4" && i < 15)) && bad5.includes(rnd[0])))
            {
                total += rnd + "2 ";
            }
            else if(rnd2 < 0.25)
            {
                total += rnd + " ";
            }
            else if(rnd2 < 0.75)
            {
                total += rnd + "2 ";
            }else
            {
                total += rnd + "' ";
            }
        }
        return total;
    }

    function getShuffle(cubearr) {
        const typemap = {"2x2x3" : "3x3x2", "2x2x4" : "2x2x4", "3x3x2": "3x3x2", "3x3x4" : "3x3x2", 
            "3x3x5" : "3x3x5", "1x4x4" : "3x3x2", "1x2x3" : "3x3x2", "3x3" : "Normal", "2x2": "Normal",
            "4x4" : "Normal", "5x5" : "Normal", "1x3x3": "Normal", "Plus Cube": "Middle Slices", "2x3x4" : "3x3x2",
            "Xmas 3x3" : "Normal", "Xmas 2x2" : "Normal"};
        const shufflenum = {"2x2x4" : 45, "2x3x4" : 45, "3x3x5" : 45, "5x5" : 45, "3x3x4" : 30, "1x4x4" : 30, "4x4" : 30};
        if (cubearr.length == 1 || typemap[cubearr[0]] == typemap[cubearr[1]]) {
            if (typemap[cubearr[0]] == typemap[cubearr[1]]) {
                return shuffleCube(typemap[cubearr[0]], Math.max(shufflenum[cubearr[0]] ?? 18, shufflenum[cubearr[1]] ?? 18));
            }
            return shuffleCube(typemap[cubearr[0]], shufflenum[cubearr[0]] ?? 18);
        } else {
            return false;
        }
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
