const { createServer } = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 7788;

const httpServer = createServer((req, res) => {
  res.writeHead(200);
  res.end('Wormhole signaling server');
});

const io = new Server(httpServer, {
  cors: { origin: '*' }
});

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
    socket.to(socket.data.roomId).emit('offer', data);
  });

  socket.on('answer', (data) => {
    socket.to(socket.data.roomId).emit('answer', data);
  });

  socket.on('candidate', (data) => {
    socket.to(socket.data.roomId).emit('candidate', data);
  });

  socket.on('disconnect', () => {
    if (socket.data.roomId) {
      socket.to(socket.data.roomId).emit('peer-offline');
    }
    delete peers[socket.id];
    console.log('peer disconnected:', socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Signaling server on :${PORT}`);
});
