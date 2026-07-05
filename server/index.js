const { createServer } = require('http');
const { Server } = require('socket.io');
const apn = require('apn');

const PORT = process.env.PORT || 7788;

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: { origin: '*' }
});

// APN provider for iOS VoIP push (set USE_PUSHKIT=true in prod)
let apnProvider = null;
if (process.env.USE_PUSHKIT === 'true') {
  apnProvider = new apn.Provider({
    cert: process.env.VOIP_CERT_PATH || './voip.pem',
    key:  process.env.VOIP_CERT_PATH || './voip.pem',
    production: process.env.NODE_ENV === 'production',
  });
}

// Track peer metadata per socket
const peers = {};

io.on('connection', (socket) => {
  console.log('peer connected:', socket.id);

  socket.on('join', ({ roomId, platform, iosToken }) => {
    socket.join(roomId);
    socket.data.roomId = roomId;
    peers[socket.id] = { roomId, platform: platform || 'android', iosToken: iosToken || null };
    socket.to(roomId).emit('peer-joined');
    console.log(`${socket.id} joined room ${roomId} (${platform || 'unknown'})`);
  });

  // Called by sender before sending — wakes iOS peer if backgrounded
  socket.on('wake-peer', async () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const roomSockets = [...(io.sockets.adapter.rooms.get(roomId) || [])];
    const otherSocketId = roomSockets.find(id => id !== socket.id);
    const peer = peers[otherSocketId];

    if (peer?.platform === 'ios' && peer?.iosToken && apnProvider) {
      await sendVoIPPush(peer.iosToken);
      console.log('VoIP push sent to iOS peer');
    }
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

  // Update iOS token if it changes
  socket.on('update-token', (iosToken) => {
    if (peers[socket.id]) {
      peers[socket.id].iosToken = iosToken;
    }
  });

  socket.on('disconnect', () => {
    if (socket.data.roomId) {
      socket.to(socket.data.roomId).emit('peer-offline');
    }
    delete peers[socket.id];
    console.log('peer disconnected:', socket.id);
  });
});

const sendVoIPPush = async (deviceToken) => {
  const note = new apn.Notification();
  note.topic   = (process.env.APP_BUNDLE_ID || 'com.p2pchat') + '.voip';
  note.payload = { wake: true };
  note.priority = 10;
  try {
    const result = await apnProvider.send(note, deviceToken);
    if (result.failed.length > 0) {
      console.error('VoIP push failed:', result.failed[0].error);
    }
  } catch (err) {
    console.error('VoIP push error:', err.message);
  }
};


httpServer.listen(PORT, () => {
  console.log(`Signaling server on :${PORT}`);
});
