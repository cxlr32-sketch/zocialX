const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname)));

// База данных в памяти
const DB = {
  users: {},
  posts: [],
  videos: [],
  chats: {},
  bank: {},
  subscriptions: {}
};

// Пассивный доход банка
setInterval(() => {
  Object.keys(DB.bank).forEach(username => {
    const user = DB.bank[username];
    if (user && user.passiveLevel > 0) {
      user.balance += user.passiveLevel;
    }
  });
}, 1000);

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ============ АВТОРИЗАЦИЯ ============
app.post('/api/register', (req, res) => {
  const { name, username, password } = req.body;
  if (!name || !username || !password) return res.json({ error: 'заполните все поля' });
  if (username.length < 3) return res.json({ error: 'никнейм мин. 3 символа' });
  if (password.length < 4) return res.json({ error: 'пароль мин. 4 символа' });
  if (DB.users[username]) return res.json({ error: 'никнейм занят' });
  
  DB.users[username] = {
    name, username, password,
    avatarImage: null,
    bio: '',
    contacts: [],
    notifications: []
  };
  
  DB.bank[username] = {
    balance: 100,
    clickLevel: 1,
    passiveLevel: 0,
    history: []
  };
  
  res.json({ success: true, user: { name, username } });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = DB.users[username];
  if (!user || user.password !== password) return res.json({ error: 'неверный никнейм или пароль' });
  
  res.json({
    success: true,
    user: {
      name: user.name,
      username,
      avatarImage: user.avatarImage,
      bio: user.bio,
      contacts: user.contacts,
      notifications: user.notifications
    }
  });
});

// ============ ПОСТЫ ============
app.get('/api/posts', (req, res) => {
  const sorted = [...DB.posts].sort((a, b) => b.timestamp - a.timestamp);
  res.json(sorted);
});

app.post('/api/posts', (req, res) => {
  const { username, text, media, mediaType } = req.body;
  if (!text && !media) return res.json({ error: 'пустой пост' });
  
  const post = {
    id: 'p' + Date.now(),
    username,
    text: text || '',
    media: media || null,
    mediaType: mediaType || null,
    time: 'только что',
    timestamp: Date.now(),
    likes: 0,
    likedBy: [],
    comments: []
  };
  
  DB.posts.push(post);
  res.json({ success: true, post });
});

app.post('/api/posts/:id/like', (req, res) => {
  const { username } = req.body;
  const post = DB.posts.find(p => p.id === req.params.id);
  if (!post) return res.json({ error: 'пост не найден' });
  
  const idx = post.likedBy.indexOf(username);
  if (idx > -1) {
    post.likedBy.splice(idx, 1);
    post.likes--;
  } else {
    post.likedBy.push(username);
    post.likes++;
  }
  
  res.json({ likes: post.likes, liked: post.likedBy.includes(username) });
});

app.post('/api/posts/:id/comment', (req, res) => {
  const { username, text } = req.body;
  const post = DB.posts.find(p => p.id === req.params.id);
  if (!post) return res.json({ error: 'пост не найден' });
  
  post.comments.push({ author: username, text });
  res.json({ success: true });
});

app.delete('/api/posts/:id', (req, res) => {
  const { username } = req.body;
  const idx = DB.posts.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.json({ error: 'пост не найден' });
  if (DB.posts[idx].username !== username) return res.json({ error: 'не ваш пост' });
  
  DB.posts.splice(idx, 1);
  res.json({ success: true });
});

// ============ ВИДЕО ============
app.get('/api/videos', (req, res) => {
  res.json([...DB.videos].sort((a, b) => b.timestamp - a.timestamp));
});

app.post('/api/videos', (req, res) => {
  const { username, title, media } = req.body;
  if (!media) return res.json({ error: 'нет видео' });
  
  const video = {
    id: 'v' + Date.now(),
    username,
    title: title || 'видео',
    media,
    time: 'только что',
    timestamp: Date.now(),
    likes: 0,
    likedBy: [],
    comments: []
  };
  
  DB.videos.push(video);
  res.json({ success: true, video });
});

// ============ ЧАТЫ ============
app.get('/api/chats/:username', (req, res) => {
  res.json(DB.chats[req.params.username] || {});
});

app.post('/api/chats/send', (req, res) => {
  const { from, to, text } = req.body;
  
  if (!DB.chats[to]) DB.chats[to] = {};
  if (!DB.chats[to][from]) DB.chats[to][from] = [];
  if (!DB.chats[from]) DB.chats[from] = {};
  if (!DB.chats[from][to]) DB.chats[from][to] = [];
  
  const msg = { from, text, time: new Date().toLocaleTimeString() };
  DB.chats[to][from].push(msg);
  DB.chats[from][to].push(msg);
  
  // Уведомление
  if (DB.users[to]) {
    DB.users[to].notifications.unshift({
      text: `новое сообщение от @${from}`,
      time: 'только что',
      unread: true
    });
  }
  
  res.json({ success: true });
});

// ============ БАНК ============
app.get('/api/bank/:username', (req, res) => {
  if (!DB.bank[req.params.username]) {
    DB.bank[req.params.username] = { balance: 100, clickLevel: 1, passiveLevel: 0, history: [] };
  }
  res.json(DB.bank[req.params.username]);
});

app.post('/api/bank/click', (req, res) => {
  const { username } = req.body;
  const bank = DB.bank[username];
  if (!bank) return res.json({ error: 'счёт не найден' });
  
  bank.balance += bank.clickLevel;
  bank.history.unshift({ type: 'клик', amount: bank.clickLevel, time: new Date().toLocaleTimeString() });
  res.json({ balance: bank.balance });
});

app.post('/api/bank/upgrade', (req, res) => {
  const { username } = req.body;
  const bank = DB.bank[username];
  const cost = bank.clickLevel * 2 * 50;
  
  if (bank.balance < cost) return res.json({ error: 'недостаточно средств' });
  
  bank.balance -= cost;
  bank.clickLevel++;
  bank.history.unshift({ type: 'улучшение', amount: -cost, time: new Date().toLocaleTimeString() });
  res.json({ balance: bank.balance, clickLevel: bank.clickLevel });
});

app.post('/api/bank/passive', (req, res) => {
  const { username } = req.body;
  const bank = DB.bank[username];
  const cost = (bank.passiveLevel + 1) * 100;
  
  if (bank.balance < cost) return res.json({ error: 'недостаточно средств' });
  
  bank.balance -= cost;
  bank.passiveLevel++;
  bank.history.unshift({ type: 'пассивный доход', amount: -cost, time: new Date().toLocaleTimeString() });
  res.json({ balance: bank.balance, passiveLevel: bank.passiveLevel });
});

app.post('/api/bank/transfer', (req, res) => {
  const { from, to, amount } = req.body;
  const senderBank = DB.bank[from];
  const receiverBank = DB.bank[to];
  
  if (!senderBank) return res.json({ error: 'отправитель не найден' });
  if (!receiverBank) return res.json({ error: 'получатель не найден' });
  if (senderBank.balance < amount) return res.json({ error: 'недостаточно средств' });
  
  senderBank.balance -= amount;
  receiverBank.balance += amount;
  
  senderBank.history.unshift({ type: 'перевод', amount: -amount, time: new Date().toLocaleTimeString() });
  receiverBank.history.unshift({ type: 'получено', amount, time: new Date().toLocaleTimeString() });
  
  // Сообщение в чат
  if (!DB.chats[to]) DB.chats[to] = {};
  if (!DB.chats[to][from]) DB.chats[to][from] = [];
  DB.chats[to][from].push({ from, text: `💰 перевёл вам ${amount} 🪙`, time: new Date().toLocaleTimeString() });
  
  // Уведомление
  if (DB.users[to]) {
    DB.users[to].notifications.unshift({
      text: `@${from} перевёл вам ${amount} 🪙`,
      time: 'только что',
      unread: true
    });
  }
  
  res.json({ success: true });
});

// ============ ПОДПИСКИ ============
app.get('/api/subs/:username', (req, res) => {
  res.json(DB.subscriptions[req.params.username] || []);
});

app.post('/api/subs/toggle', (req, res) => {
  const { subscriber, target } = req.body;
  
  if (!DB.subscriptions[subscriber]) DB.subscriptions[subscriber] = [];
  
  const idx = DB.subscriptions[subscriber].indexOf(target);
  if (idx > -1) {
    DB.subscriptions[subscriber].splice(idx, 1);
    res.json({ subscribed: false });
  } else {
    DB.subscriptions[subscriber].push(target);
    res.json({ subscribed: true });
  }
});

// ============ ПОЛЬЗОВАТЕЛИ ============
app.get('/api/users', (req, res) => {
  const users = Object.keys(DB.users).map(u => ({
    username: u,
    name: DB.users[u].name,
    avatarImage: DB.users[u].avatarImage,
    bio: DB.users[u].bio
  }));
  res.json(users);
});

app.get('/api/users/:username', (req, res) => {
  const user = DB.users[req.params.username];
  if (!user) return res.json({ error: 'пользователь не найден' });
  
  res.json({
    name: user.name,
    username: req.params.username,
    avatarImage: user.avatarImage,
    bio: user.bio
  });
});

// ============ ПРОФИЛЬ ============
app.post('/api/profile/update', (req, res) => {
  const { username, name, bio, avatarImage } = req.body;
  const user = DB.users[username];
  if (!user) return res.json({ error: 'пользователь не найден' });
  
  if (name) user.name = name;
  if (bio !== undefined) user.bio = bio;
  if (avatarImage) user.avatarImage = avatarImage;
  
  res.json({ success: true, user: { name: user.name, bio: user.bio, avatarImage: user.avatarImage } });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`❄️ Zocial сервер запущен на порту ${PORT}`);
});