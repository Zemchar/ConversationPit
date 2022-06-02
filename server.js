const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const formatMessage = require('./utils/messages');
const {userJoin, getCurrentUser, userLeave, getRoomUsers} = require('./utils/users');
const moment = require('moment');
var mysql = require('mysql');
const { query } = require('express');
const app = express();
const server = http.createServer(app);
const io = socketio(server);
var conn = mysql.createConnection({host:'localhost', user:'juniper', password:'raspberry', database:'chat'})
// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

const botName = 'The Host';
var votingDict = {};
var noLogRooms = Array();
// Run when client connects
io.on('connection', socket => {
  socket.on('joinRoom', ({ username, room }) => {
    const user = userJoin(socket.id, username, room);
    if(!(user.room in io.sockets.adapter.rooms)){
      var sql =`CREATE TABLE IF NOT EXISTS ${user.room}(id bigint(11) NOT NULL AUTO_INCREMENT, name varchar(255) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL DEFAULT 'UnkownUSER727', timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, contents varchar(5000) NULL DEFAULT NULL, html varchar(5080) NOT NULL DEFAULT '', PRIMARY KEY (id));`
      conn.query(sql, function (err, result) {
        if (err) throw err;
        console.log(`[DATABASE] Attempting to create room DB: ${room}`)
        if(result["warningCount"] > 0) {
          console.warn("\x1b[33m[DATABASE] Warning Found. Diagnosing... \x1b[0m")
          conn.query("SHOW WARNINGS;", (err, result) => {
            result = JSON.parse(JSON.stringify(result))
            console.warn(`\x1b[33m[DATABASE] Warning Code: ${result[0]["Code"]}\x1b[0m`)
            if(result[0]["Code"] == 1050){
              console.log(`[DATABASE] Database for room ${room} already exists. Populating last 50 messages for user ${username} [ID: ${socket.id}]`)
              populate(user.room, 50, null)}})}})} 
    else{
      populate(user.room, 50, null)
    }
    socket.join(user.room);

    // Welcome current user
    socket.emit('sys', "echo", formatMessage(null, `<b>${user.username}</b> joined Conversation Pit`));
    // Broadcast when a user connects
    socket.broadcast.to(user.room).emit("sys", "echo", formatMessage(null, `<b>${user.username}</b> joined Conversation Pit`));
    // Send users and room info
    io.to(user.room).emit('roomUsers', {
      room: user.room,
      users: getRoomUsers(user.room)
    });
  });
  socket.on("noLogReq", vote => { 
    const user = getCurrentUser(socket.id)
    if(vote === "RESET VOTE"){
      noLogRooms.splice(noLogRooms.indexOf(user.room), 1)
      console.log(`[SERVER] No Logs Deactivated for room: ${user.room}`)
      io.to(user.room).emit("sys", "noLogVoteFail", formatMessage("SYSTEM MESSAGE", "Logs are now being made for this room"))
      return
    }
    if(!(toString(user.room) in votingDict) && vote == null){
      votingDict[user.room] = {};
      votingDict[user.room][socket.id] = "Yes"
      io.to(user.room).emit("sys", "noLogVoteStart", user.username)
      console.log(`[SERVER] No Log Vote Requested for room: ${user.room}`)
      return
    }
    // var voterIndex = votingDict[user.room]
    // if(user in voterIndex){
    //   io.to(user).emit("message", formatMessage(botName, "You have already voted to deactivate logs!\n\n[Only you can see this]"))//Hijacks normal message system to make the alert more visible
    // }
    if(vote === "false"){
      noLogRooms.splice(noLogRooms.indexOf(toString(user.room)), 1) //deletes no log check
      delete votingDict[user.room]
      io.to(user.room).emit("sys", "noLogVoteFail", formatMessage("SYSTEM MESSAGE", "No Log vote failed; Logs are still being recorded for this room"))
      console.log(`[SERVER] No log vote for room ${user.room} failed`)
      return
    }
    if(vote === "true") {
      votingDict[user.room][socket.id] = "Yes";// this yes is arbitrary, i just dont want to keep creating arrays
      io.to(user.room).emit("sys", "echo", formatMessage(null, `<b>${user.username}</b> Has voted <b>Yes</b> to disabling logs.`))
    }
    if(Object.keys(votingDict[user.room]).length == getRoomUsers(user.room).length){
      noLogRooms.push(user.room)
      io.to(user.room).emit("sys", "noLogActive", formatMessage("SYSTEM MESSAGE", "No Log Vote Passed; Logs will not be recorded for this room anymore."))
      console.log(`[SERVER] No log vote for room ${user.room} suceeded`)
    }
  });
  socket.on("populateReq", (limit, indexFrom) => {
    const user = getCurrentUser(socket.id);

    populate(user.room, limit, indexFrom)
  })
  // Listen for chatMessage
  socket.on('chatMessage', msg => {
    const user = getCurrentUser(socket.id);
    io.to(user.room).emit('message', formatMessage(user.username, msg));
    //logging func
    if(noLogRooms.indexOf(user.room) != -1){return}
    else{
      let ts = Date.now()
      let TIMESTAMPOBJ = new Date(ts);
      let timestamp = TIMESTAMPOBJ.getHours() + ":" + TIMESTAMPOBJ.getMinutes() + ":" + TIMESTAMPOBJ.getSeconds() + " On " + TIMESTAMPOBJ.getMonth() + "/" + TIMESTAMPOBJ.getDate() +"/" + TIMESTAMPOBJ.getFullYear()
      var sql = `INSERT INTO ${user.room} (contents, name, html) VALUES (?, ?, ?);`
      conn.query(sql, [msg.toString(), user.username.toString(), `<div class="message"><p class="meta">${user.username.toString()}<span> ${timestamp.toString()}</span></p><p class="text">${msg.toString()}</p></div>`], function (err, result) {
        if (err) throw err;
      });
  }});

  socket.on('watchActive', function() {
    const user = getCurrentUser(socket.id);
    io.to(user.room).emit('sys', 'watch', formatMessage(null, `<b>${user.username}</b> BEEP BEEP BEEP BEEP`))
  })
  /**
   * A function that retrieves and sends calls for logged messages to be displayed on the client's browser
   * @param {roomObject} room Room object to pull messages from 
   * @param {int} limit Limit of messages to retreive
   * @param {int} indexFrom ID Of last populated message. If left blank instead retrieves messages before the current time.
   */
  function populate(room, limit, indexFrom) {
    if(indexFrom === null) { // FOR INITAL LOADING. Just get most recent
      let sql = `SELECT id, html FROM ${room} WHERE timestamp < CURRENT_TIMESTAMP ORDER BY id DESC LIMIT ${limit}`
      conn.query(sql, function (err, result) {
        if(err){ throw err};
        result = JSON.parse(JSON.stringify(result))
        io.to(socket.id).emit("populator", "inital", `<button type="button" id="${result[result.length - 1]["id"]}" class="populator" onclick="socket.emit('populateReq', 50, $(this).attr('id'));$(this).remove();">The Slay Button</button>`)
        for (let index = 0; index < limit && index < result.length; index++) {
          const element = result[index];
          io.to(socket.id).emit("populator", `${index}/${result.length}: ${element['html']}`, element['html'])
        }
      })

    }
    if(parseInt(indexFrom) === 1){
      io.to(socket.id).emit("queryFail")
    }
    else if(indexFrom != null){
      let sql = `SELECT id, html FROM ${room} WHERE id < ${indexFrom} ORDER BY id DESC LIMIT ${limit}`
      conn.query(sql, function (err, result) {
        if(err){ throw err};
        result = JSON.parse(JSON.stringify(result))
        io.to(socket.id).emit("populator", "inital", `<button type="button" id="${result[result.length - 1]["id"]}" class="populator" onclick="socket.emit('populateReq', 50, $(this).attr('id'))">The Slay Button</button>`)
        for (let index = 0; index < limit && index < result.length; index++) {
          const element = result[index];
          io.to(socket.id).emit("populator", `${result[index]}/${result.length}`, element['html'])
        }
        
      })
    }
  }
  // Runs when client disconnects
  socket.on('disconnect', () => {
    const user = userLeave(socket.id);

    if (user) {
      io.to(user.room).emit('sys', "echo", formatMessage(null, `${user.username} has left the chat`));

      // Send users and room info
      io.to(user.room).emit('roomUsers', {room: user.room, users: getRoomUsers(user.room)});
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => console.log(`\u001b[32;1m[SERVER] Server running on port ${PORT}\u001b[0m`));
