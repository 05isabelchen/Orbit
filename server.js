const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

app.use(express.static('public')); // serves your index.html

const users   = {}; // { socketId: { id, name, emoji, status } }
const invites = {}; // { userId: [ invite, ... ] }

io.on('connection', socket => {

  // User joins
  socket.on('login', ({ id, name, emoji }) => {
    users[socket.id] = { id, name, emoji, status: 'online', socketId: socket.id };
    io.emit('users_updated', Object.values(users)); // broadcast to everyone
    console.log(`${name} joined`);
  });

  // Someone sends an invite
  socket.on('send_invite', ({ toIds, place, placeEmoji, dist, message }) => {
    const from = users[socket.id];
    if (!from) return;

    toIds.forEach(targetUserId => {
      const targetSocket = Object.values(users).find(u => u.id === targetUserId);
      if (!targetSocket) return;

      const invite = {
        id: Date.now() + Math.random().toString(36).slice(2),
        from: { name: from.name, emoji: from.emoji, status: 'online' },
        place, placeEmoji, dist, distNear: true,
        message: message || '',
        time: 'just now', status: 'pending'
      };

      // Store it
      if (!invites[targetUserId]) invites[targetUserId] = [];
      invites[targetUserId].push(invite);

      // Send to recipient in real time
      io.to(targetSocket.socketId).emit('new_invite', invite);
    });
  });

  // Invite accepted/declined
  socket.on('resolve_invite', ({ inviteId, action, fromUserId }) => {
    const resolver = users[socket.id];
    const fromSocket = Object.values(users).find(u => u.id === fromUserId);
    if (fromSocket) {
      io.to(fromSocket.socketId).emit('invite_resolved', {
        inviteId, action, byName: resolver?.name
      });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      console.log(`${user.name} left`);
      delete users[socket.id];
      io.emit('users_updated', Object.values(users));
    }
  });
});

server.listen(3000, '0.0.0.0', () => {
  console.log('Orbit running on http://localhost:3000');
  console.log('Other devices: http://YOUR_LOCAL_IP:3000');
});