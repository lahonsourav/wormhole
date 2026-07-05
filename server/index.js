const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

const PORT = process.env.PORT || 7788;

app.get('/', (req, res) => res.send('Wormhole signaling server'));

const peers = {};

io.on('connection', (socket) => {
  console.log('peer connected:', socket.id);

  socket.on('join', ({ roomId, platform }) => {
    socket.join(roomId);
    socket.data.roomId = roomId;
    peers[socket.id] = { roomId, platform: platform || 'android' };
    socket.to(roomId).emit('peer-joined');
    console.log(`${socket.id} joined room ${roomId}`);
  });

  socket.on('offer', (data) => {
    console.log(`[${socket.data.roomId}] offer relayed from ${socket.id}`);
    socket.to(socket.data.roomId).emit('offer', data);
  });

  socket.on('answer', (data) => {
    console.log(`[${socket.data.roomId}] answer relayed from ${socket.id}`);
    socket.to(socket.data.roomId).emit('answer', data);
  });

  socket.on('candidate', (data) => {
    const type = data?.candidate?.match(/ typ (\w+)/)?.[1] || 'unknown';
    console.log(`[${socket.data.roomId}] candidate relayed from ${socket.id}: typ=${type}`);
    socket.to(socket.data.roomId).emit('candidate', data);
  });

  socket.on('disconnect', () => {
    if (socket.data.roomId) socket.to(socket.data.roomId).emit('peer-offline');
    delete peers[socket.id];
    console.log('peer disconnected:', socket.id);
  });
});

process.on('uncaughtException',  (err) => console.error('uncaught:', err.message));
process.on('unhandledRejection', (err) => console.error('unhandled:', err));

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Signaling server on :${PORT}`);
});
