// const formatMessage = require("../../utils/messages");

const chatForm = document.getElementById('chat-form');
const chatMessages = document.querySelector('.chat-messages');
const systemMessages = document.querySelector("#system-alerts")
const roomName = document.getElementById('room-name');
const userList = document.getElementById('users');
const watch = document.getElementById('beepbeep');
const nolog = document.getElementById('nolog')
const parser = new DOMParser();

// Get username and room from URL
var { username, room, theme } = Qs.parse(location.search, {
  ignoreQueryPrefix: true,
});

const socket = io();
// Join chatroom
socket.emit('joinRoom', { username, room });

// Get room and users
socket.on('roomUsers', ({ room, users }) => {
  outputRoomName(room);
  outputUsers(users);
});

// Message from server
socket.on('message', (message) => {
  console.log(`[SERVER] ${message}`);
  outputMessage(message);

  // Scroll down
});
socket.on('populator', (code, data) => {
  if(code == "inital"){
    $(".chat-messages").prepend($.parseHTML(data))
  }
  else{
    $($.parseHTML(data)).insertAfter(".populator")
  }
  chatMessages.scrollTop = chatMessages.scrollHeight;
})
socket.on("queryFail", function() {
  $(".populator").text("You Have Reached The Bottom Of This Pit")
  $(".populator").css("pointerEvents" , "none");

})
socket.on('sys', function(code, data) {
  if(code=="echo"){
    outputSystemMessage(data)
    $("#system-alerts").scrollTop($("#system-alerts").height())

  }
  if(code=="watch"){
    outputSystemMessage(data)
    $("main").prepend(`<img class="float skull" src="./css/skull.gif" onanimationend="$(this).fadeOut(500, 'swing', function() {$(this).remove()})"></img>`)
    $("#system-alerts").scrollTop($("#system-alerts")[0].scrollHeight)
  }
  if(code == "noLogVoteStart") {
    outputMessageWithButtons(`${data} Has requested NoLog mode for this room. Do you consent?`, {text: "Yes", classes: "btn votingbtn", action: "$('.votingbtn').remove();socket.emit('noLogReq', 'true');"}, {text: "No", classes: "btn votingbtn", action: "$('.votingbtn').remove();socket.emit('noLogReq', 'false');"})
  }
  if(code == "noLogActive") {
    $(".urgent").remove();
    outputMessage(data)
    nolog.style.pointerEvents = "auto"
    nolog.style.opacity = 1
    nolog.innerText = "Activate Logs"
  }
  if(code == "noLogVoteFail") {
    $(".urgent").remove()
    outputMessage(data)
    nolog.style.pointerEvents = "auto"
    nolog.style.opacity = 1
    nolog.innerText = "No Logs"
  }

});

// Message submit
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();

  // Get message text
  let msg = e.target.elements.msg.value;

  msg = msg.trim();

  if (!msg) {
    return false;
  }

  // Emit message to server
  socket.emit('chatMessage', msg);

  // Clear input
  e.target.elements.msg.value = '';
  e.target.elements.msg.focus();
});
watch.addEventListener('click', function() {
  socket.emit('watchActive');//cool watch function
});
nolog.addEventListener('click', function() {
  if(nolog.innerText == "Activate Logs"){
    socket.emit('noLogReq', "RESET VOTE")
  }
  else if(nolog.innerText == "No Logs" ) {
    nolog.style.pointerEvents = "none";
    nolog.style.opacity = 0.5 
    nolog.innerText = "Vote In Progress"
    socket.emit('noLogReq', null)
  }
})
function outputSystemMessage(message) {
  const para = document.createElement('li');  
  if (message.username != null){}
  para.innerHTML = `${message.time}: ${message.text}<br>`;
  document.querySelector('#system-alerts').appendChild(para);
}
// Output message to DOM
/**
 * Creates a system generated message with clickable buttons with actions.
 * @returns Nothing. This function directly edits the dom
 * @param {string} message the message body that normally appears
 * @param {object} buttons the buttons to add. Should be passed like a dictionary with the keys: text, classes, action. Action should be javascript
 */
function outputMessageWithButtons(message,...buttons) {
  var outputConstructor = `<div class="message urgent"><p class="meta">SYSTEM MESSAGE</p><p class="text">${message}</p>`

  for (let index = 0; index < buttons.length; index++) {
    const element = buttons[index];
    outputConstructor += `<button type='button' onclick="${element["action"]}" class='${element["classes"]}'>${element["text"]}</button>`
  }
  outputConstructor += "</div>"
  $('.chat-messages').append($.parseHTML(outputConstructor))
  chatMessages.scrollTop = chatMessages.scrollHeight;

}
function outputMessage(message) {
  const div = document.createElement('div');
  div.classList.add('message');
  const p = document.createElement('p');
  p.classList.add('meta');
  p.innerText = message.username;
  p.innerHTML += ` <span>${message.time}</span>`;
  div.appendChild(p);
  const para = document.createElement('p');
  para.classList.add('text');
  if(message.text.includes("https://") || message.text.includes("http://") || message.text.includes("www.")){message.text = linky(message.text);para.innerHTML += message.text}
  else{para.innerText = message.text;}
  div.appendChild(para);
  document.querySelector('.chat-messages').appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;

}
// Add room name to DOM 
// tell me why this function is critical. why did i delete it and everything broke. who designed this
/**
 * dont fucking. use this fucntion why does it exist why does it break when i do the littles thing i removed it once and stuff COMPLETLY unrelated broke tell me why. tell me.
 * Its never used. Its never referenced. It just is.
 */
function outputRoomName(room) {
  roomName.innerText = room;
}

// Add users to DOM
function outputUsers(users) {
  userList.innerHTML = '';
  users.forEach((user) => {
    const li = document.createElement('li');
    li.innerHTML = `<i class="fas fa-user"></i> ${user.username} <br>`;
    userList.appendChild(li);
  });
}
function loadTheme() {
  $("body").attr("class", `${theme}`)
}
function switchtheme() {
  $("body").attr("class", `${theme == "space" ? "lemon" : "space"}`);
  theme = $("body").attr("class") 
}
//Prompt the user before leave chat room
document.getElementById('leave-btn').addEventListener('click', () => {
  const leaveRoom = confirm('Are you sure you want to leave the chatroom?');
  if (leaveRoom) {
    window.location = '../index.html';
  } else {
  }
});
function linky(text) { // thanks google dev
  return (text || '').replace(/([^\S]|^)(((https?\:\/\/)|(www\.))(\S+))/gi, function (match, space, url) {
    var hyperlink = url;
    if (!hyperlink.match('^https?://')) {
      hyperlink = 'http://' + hyperlink;
    }
    return space + '<a href="' + hyperlink + '" target="_blank">' + url + '</a>';
  });
}