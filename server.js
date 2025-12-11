const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const QRCode = require('qrcode');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static('public'));
app.use(express.json());

// 存储所有房间的画布数据和Markdown数据
const rooms = new Map();
const markdownData = new Map();
// 存储房间的在线用户和创建者
const roomUsers = new Map(); // { roomId: Set<socketId> }
const roomCreators = new Map(); // { roomId: creatorSocketId }
// 存储Markdown内容的所有权信息
const markdownOwnership = new Map(); // { roomId: [{ start, end, owner, content }] }

// 获取本机IP地址
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return 'localhost';
}

// 生成二维码
app.get('/api/qrcode/:roomId', async (req, res) => {
  const roomId = req.params.roomId;
  
  // 优先使用环境变量中的公网IP和端口
  const publicIP = process.env.PUBLIC_IP || req.headers['x-forwarded-host'] || req.get('host').split(':')[0];
  const publicPort = process.env.PUBLIC_PORT || 8080;
  
  // 如果在Docker环境或云服务器，使用公网地址
  let url;
  if (process.env.PUBLIC_IP) {
    // 如果端口是443，使用https，否则使用http
    const protocol = publicPort === '443' ? 'https' : 'http';
    const portSuffix = (publicPort === '443' || publicPort === '80') ? '' : `:${publicPort}`;
    url = `${protocol}://${publicIP}${portSuffix}/?room=${roomId}`;
  } else {
    // 本地开发环境使用本地IP
    const localIP = getLocalIP();
    const port = server.address()?.port || 3000;
    url = `http://${localIP}:${port}/?room=${roomId}`;
  }
  
  try {
    const qrCode = await QRCode.toDataURL(url);
    res.json({ qrCode, url });
  } catch (err) {
    res.status(500).json({ error: '生成二维码失败' });
  }
});

// Socket.IO 连接处理
io.on('connection', (socket) => {
  console.log('新用户连接:', socket.id);
  
  // 加入房间
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`用户 ${socket.id} 加入房间 ${roomId}`);
    
    // 如果房间不存在，创建新房间
    if (!rooms.has(roomId)) {
      rooms.set(roomId, []);
    }
    if (!markdownData.has(roomId)) {
      markdownData.set(roomId, '');
    }
    if (!roomUsers.has(roomId)) {
      roomUsers.set(roomId, new Set());
    }
    if (!markdownOwnership.has(roomId)) {
      markdownOwnership.set(roomId, []);
    }
    
    // 设置房间创建者（第一个加入的用户）
    if (!roomCreators.has(roomId)) {
      roomCreators.set(roomId, socket.id);
      console.log(`用户 ${socket.id} 成为房间 ${roomId} 的创建者`);
    }
    
    // 将用户添加到房间用户列表
    roomUsers.get(roomId).add(socket.id);
    
    // 发送当前画布数据给新用户
    socket.emit('canvas-data', rooms.get(roomId));
    
    // 发送当前Markdown数据和所有权信息给新用户
    const isCreator = roomCreators.get(roomId) === socket.id;
<<<<<<< HEAD
    const creatorId = roomCreators.get(roomId);
=======
>>>>>>> 3e4dcf966ef6456cbe46f2cc785d50eb65f93ff4
    socket.emit('markdown-data', {
      content: markdownData.get(roomId),
      ownership: markdownOwnership.get(roomId),
      isCreator: isCreator,
<<<<<<< HEAD
      userId: socket.id,
      creatorId: creatorId
=======
      userId: socket.id
>>>>>>> 3e4dcf966ef6456cbe46f2cc785d50eb65f93ff4
    });
    
    // 广播当前在线人数给房间内所有用户
    const userCount = roomUsers.get(roomId).size;
    io.to(roomId).emit('user-count-update', userCount);
    
    // 通知房间内其他用户
    socket.to(roomId).emit('user-joined', socket.id);
  });
  
  // 接收绘画数据
  socket.on('draw', (data) => {
    const { roomId, drawData } = data;
    
    // 保存到房间数据
    if (rooms.has(roomId)) {
      rooms.get(roomId).push(drawData);
    }
    
    // 广播给房间内其他用户
    socket.to(roomId).emit('draw', drawData);
  });
  
  // Markdown更新（带所有权信息）
  socket.on('markdown-update', (data) => {
    const { roomId, content, ownership } = data;
    
    // 保存Markdown内容和所有权信息
    if (markdownData.has(roomId)) {
      markdownData.set(roomId, content);
      markdownOwnership.set(roomId, ownership);
    }
    
    // 广播给房间内其他用户
    socket.to(roomId).emit('markdown-update', { content, ownership });
  });
  
  // 文档加载（重置所有权为房间创建者）
  socket.on('markdown-loaded', (data) => {
    const { roomId, content } = data;
    const creatorId = roomCreators.get(roomId);
    
    // 将整个文档标记为创建者所有
    const newOwnership = content.length > 0 ? [{
      start: 0,
      end: content.length,
      owner: creatorId
    }] : [];
    
    // 保存内容和所有权
    markdownData.set(roomId, content);
    markdownOwnership.set(roomId, newOwnership);
    
    // 广播给房间内所有用户
    io.to(roomId).emit('markdown-update', { content, ownership: newOwnership });
  });
  
  // 断开连接
  socket.on('disconnect', () => {
    console.log('用户断开连接:', socket.id);
    
    // 从所有房间中移除该用户
    roomUsers.forEach((users, roomId) => {
      if (users.has(socket.id)) {
        users.delete(socket.id);
        
        // 广播更新后的在线人数
        const userCount = users.size;
        io.to(roomId).emit('user-count-update', userCount);
        
        // 如果房间为空，清理数据
        if (users.size === 0) {
          rooms.delete(roomId);
          markdownData.delete(roomId);
          roomUsers.delete(roomId);
          roomCreators.delete(roomId);
          markdownOwnership.delete(roomId);
          console.log(`房间 ${roomId} 已清空并删除`);
        }
      }
    });
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  const localIP = getLocalIP();
  console.log(`服务器运行在:`);
  console.log(`- 本地: http://localhost:${PORT}`);
  console.log(`- 网络: http://${localIP}:${PORT}`);
});
