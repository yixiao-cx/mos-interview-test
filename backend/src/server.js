const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const db = require('./db');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// 数据库初始化
db.init();

// API路由
app.get('/api/scores', async (req, res) => {
  try {
    const scores = await db.getTopScores();
    res.json(scores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/scores', async (req, res) => {
  try {
    const { playerName, score } = req.body;
    await db.saveScore(playerName, score);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Socket.IO事件处理
io.on('connection', (socket) => {
  console.log('玩家已连接');

  socket.on('gameStart', (data) => {
    console.log('玩家开始游戏:', data.playerName);
    socket.broadcast.emit('playerJoined', { playerName: data.playerName });
  });

  socket.on('scoreUpdate', (data) => {
    console.log('分数更新:', data.playerName, data.score);
    socket.broadcast.emit('playerScore', {
      playerName: data.playerName,
      score: data.score,
      level: data.level
    });
  });

  socket.on('levelUp', (data) => {
    console.log('玩家升级:', data.playerName, data.level);
    socket.broadcast.emit('playerLevelUp', {
      playerName: data.playerName,
      level: data.level
    });
  });

  socket.on('gameOver', (data) => {
    console.log('游戏结束:', data.playerName, data.finalScore);
    socket.broadcast.emit('playerGameOver', {
      playerName: data.playerName,
      score: data.finalScore
    });
  });

  socket.on('victory', (data) => {
    console.log('玩家胜利:', data.playerName, data.finalScore);
    socket.broadcast.emit('playerVictory', {
      playerName: data.playerName,
      score: data.finalScore
    });
  });

  socket.on('disconnect', () => {
    console.log('玩家已断开连接');
  });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});
