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
    
    // 发送当前画布数据给新用户
    socket.emit('canvas-data', rooms.get(roomId));
    
    // 发送当前Markdown数据给新用户
    socket.emit('markdown-data', markdownData.get(roomId));
    
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
  
  // 清空画布
  socket.on('clear-canvas', (roomId) => {
    if (rooms.has(roomId)) {
      rooms.set(roomId, []);
    }
    io.to(roomId).emit('clear-canvas');
  });
  
  // Markdown更新
  socket.on('markdown-update', (data) => {
    const { roomId, content } = data;
    
    // 保存Markdown内容
    if (markdownData.has(roomId)) {
      markdownData.set(roomId, content);
    }
    
    // 广播给房间内其他用户
    socket.to(roomId).emit('markdown-update', content);
  });
  
  // 清空Markdown
  socket.on('clear-markdown', (roomId) => {
    if (markdownData.has(roomId)) {
      markdownData.set(roomId, '');
    }
    io.to(roomId).emit('clear-markdown');
  });
  
  // 断开连接
  socket.on('disconnect', () => {
    console.log('用户断开连接:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  const localIP = getLocalIP();
  console.log(`服务器运行在:`);
  console.log(`- 本地: http://localhost:${PORT}`);
  console.log(`- 网络: http://${localIP}:${PORT}`);
});
