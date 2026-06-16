const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// ── consultas al mail ───────────────────────────────────────────────────────────────
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

// ── mercadopago ───────────────────────────────────────────────────────────────
const { MercadoPagoConfig, Preference } = require('mercadopago');

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

const preferenceClient = new Preference(client);

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.set('trust proxy', 1);

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true, sameSite: 'none', maxAge: 24 * 60 * 60 * 1000 }
});
app.use(sessionMiddleware);

// Compartir sesión de Express con Socket.io
io.use((socket, next) => {
  sessionMiddleware(socket.request, socket.request.res || {}, next);
});

// ── Simple file-based "DB" ─────────────────────────────────────────────────────
const DB_PATH = path.join(__dirname, 'data', 'db.json');
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });

function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    const initial = { users: [], orders: [], raffles: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function saveDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ── Productos ──────────────────────────────────────────────────────────────────
const PRODUCTS_PATH = path.join(__dirname, '..', 'data', 'products', 'products.json');

function loadProducts() {
  try {
    if (!fs.existsSync(PRODUCTS_PATH)) {
      fs.writeFileSync(PRODUCTS_PATH, '[]');
      return [];
    }

    const data = fs.readFileSync(PRODUCTS_PATH, 'utf8');

    if (!data.trim()) {
      return [];
    }

    return JSON.parse(data);
  } catch (err) {
    console.error('ERROR products.json:', err);
    return [];
  }
}
function saveProducts(products) {
  fs.writeFileSync(PRODUCTS_PATH, JSON.stringify(products, null, 2));
}
// ── Auth helpers ───────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'No autenticado' });
  next();
}

function requireAdmin(req, res, next) {

  if (!req.session.userId) {
    return res.status(401).json({
      error: 'No autenticado'
    });
  }

  if (req.session.userEmail !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({
      error: 'Acceso denegado'
    });
  }

  next();
}

// ── API REST ───────────────────────────────────────────────────────────────────
app.get('/api/products', (req, res) => {
  const { category, search } = req.query;
  let products = loadProducts();
  if (category) {
    products = products.filter(
      p => p.category === category
    );
  }

  if (search) {
    products = products.filter(
      p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase())
    );
  }

  res.json(products);
});

app.get('/api/products/:id', (req, res) => {
  const products = loadProducts();
  const product = products.find(
    p => p.id === parseInt(req.params.id)
  );
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(product);
});

app.get('/api/cart', (req, res) => res.json(req.session.cart || []));

app.post('/api/cart', (req, res) => {
  const { productId, quantity = 1 } = req.body;

  const products = loadProducts();

  const product = products.find(
    p => p.id === parseInt(productId)
  );

  if (!product) {
    return res.status(404).json({ error: 'Producto no encontrado' });
  }

  if (!req.session.cart) {
    req.session.cart = [];
  }

  const existing = req.session.cart.find(
    i => i.productId === productId
  );

  if (existing) {
    existing.quantity += quantity;
  } else {
    req.session.cart.push({
      productId,
      quantity,
      name: product.name,
      price: product.price,
      emoji: product.emoji,
      image: product.image
    });
  }

  res.json(req.session.cart);
});

app.put('/api/cart/:productId', (req, res) => {
  const productId = parseInt(req.params.productId);
  const { quantity } = req.body;
  if (!req.session.cart) return res.json([]);
  if (quantity <= 0) { req.session.cart = req.session.cart.filter(i => i.productId !== productId); }
  else { const item = req.session.cart.find(i => i.productId === productId); if (item) item.quantity = quantity; }
  res.json(req.session.cart);
});

app.delete('/api/cart/:productId', (req, res) => {
  req.session.cart = (req.session.cart || []).filter(i => i.productId !== parseInt(req.params.productId));
  res.json(req.session.cart);
});

app.delete('/api/cart', (req, res) => { req.session.cart = []; res.json([]); });

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Todos los campos son requeridos' });
  if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  const db = loadDB();
  if (db.users.find(u => u.email === email)) return res.status(409).json({ error: 'El email ya está registrado' });
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = { id: Date.now(), name, email, password: hashedPassword, createdAt: new Date() };
  db.users.push(user);
  saveDB(db);
  req.session.userId = user.id;
  req.session.userName = user.name;

  res.json({ id: user.id, name: user.name, email: user.email });
});

app.post('/api/auth/login', async (req, res) => {

  const { email, password } = req.body;

  const db = loadDB();

  const user = db.users.find(u => u.email === email);

  if (!user) {
    return res.status(401).json({
      error: 'Credenciales inválidas'
    });
  }

  const valid = await bcrypt.compare(password, user.password);

  if (!valid) {
    return res.status(401).json({
      error: 'Credenciales inválidas'
    });
  }

  req.session.userId = user.id;
  req.session.userName = user.name;
  req.session.userEmail = user.email;

  res.json({
    id: user.id,
    name: user.name,
    email: user.email
  });
});

app.post('/api/auth/logout', (req, res) => { req.session.destroy(); res.json({ message: 'Sesión cerrada' }); });
app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) return res.json(null);
  res.json({ id: req.session.userId, name: req.session.userName });
});

app.post('/api/create-payment', requireAuth, async (req, res) => {
  const cart = req.session.cart || [];

  if (!cart.length) {
    return res.status(400).json({ error: 'El carrito está vacío' });
  }

  const { shippingZone } = req.body;
  req.session.shippingZone = shippingZone;

  const shippingRates = {
    Florida: 0,
    Montevideo: 260,
    Canelones: 230,
    Maldonado: 260,
    "Interior del País": 450
  };

  if (!shippingZone || !shippingRates.hasOwnProperty(shippingZone)) {
    return res.status(400).json({ error: 'Zona de envío inválida' });
  }

  const shippingCost = shippingRates[shippingZone] || 0;

  const db = loadDB();

  db.orders = db.orders || [];
  db.users = db.users || [];
  db.raffles = db.raffles || [];

  const order = {
    id: Date.now(),
    userId: req.session.userId,
    items: cart,
    shippingZone,
    shippingCost,
    status: 'pending',
    createdAt: new Date()
  };

  db.orders.push(order);
  saveDB(db);

  const items = cart.map(item => ({
    title: item.name,
    quantity: Number(item.quantity),
    currency_id: 'UYU',
    unit_price: Number(item.price)
  }));

  if (shippingCost > 0) {
    items.push({
      title: 'Envío',
      quantity: 1,
      currency_id: 'UYU',
      unit_price: shippingCost
    });
  }

  try {
    const preference = {
      items,
      external_reference: String(order.id),

      // 🔥 IMPORTANTE: usa ngrok o dominio real
      back_urls: {
        success: 'https://d715-2800-a4-654-1900-a099-12ea-4f73-856e.ngrok-free.app/success',
        failure: 'https://d715-2800-a4-654-1900-a099-12ea-4f73-856e.ngrok-free.app/failure',
        pending: 'https://d715-2800-a4-654-1900-a099-12ea-4f73-856e.ngrok-free.app/pending'
      },

      auto_return: 'approved',

      // 🔥 CLAVE QUE TE FALTA
      notification_url: 'https://ironicpool-production.up.railway.app/api/webhook'
    };

    const response = await preferenceClient.create({
      body: preference
    });

    return res.json({
      init_point: response.init_point
    });

  } catch (error) {
    console.error('MercadoPago error:', error);
    return res.status(500).json({
      error: 'No se pudo crear el pago'
    });
  }
});

app.post('/api/webhook', (req, res) => {
  console.log(req.body);
  res.sendStatus(200);
});

app.get('/success', (req, res) => {
  req.session.cart = [];
  res.redirect('/gracias.html');
});

app.get('/pending', (req, res) => {
  res.send(`
    <h1>⏳ Pago pendiente</h1>
    <a href="/">Volver a la tienda</a>
  `);
});

app.post('/api/products', (req, res) => {

  const products = loadProducts();

  const newProduct = {
    id: Date.now(),
    ...req.body
  };

  products.push(newProduct);

  saveProducts(products);

  res.json(newProduct);
});


app.get('/api/admin/users', requireAuth, (req, res) => {

  console.log("EMAIL EN SESION:", req.session.userEmail);

  if (req.session.userEmail !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({
      error: 'Acceso denegado',
      emailSesion: req.session.userEmail
    });
  }

  const db = loadDB();

  res.json(db.users);
});

app.get('/api/debug/session', (req, res) => {
  res.json(req.session);
});

app.get('/api/shipping/:zone', (req, res) => {
  const rates = {
    Florida: 0,
    Montevideo: 260,
    Canelones: 230,
    Maldonado: 260,
    "Interior del País": 450
  };

  const cost = rates[req.params.zone] ?? 0;
  res.json({ cost });
});


// ── CHAT con Socket.io ─────────────────────────────────────────────────────────
const chatHistory = []; // últimos 50 mensajes en memoria
const onlineUsers = new Map(); // socketId → { name, id }

io.on('connection', (socket) => {
  const session = socket.request.session;

  // Solo usuarios autenticados pueden conectarse al chat
  if (!session || !session.userId) {
    socket.emit('chat:error', 'Debes iniciar sesión para usar el chat');
    socket.disconnect();
    return;
  }

  const userName = session.userName;
  const userId = session.userId;

  onlineUsers.set(socket.id, { name: userName, id: userId });

  // Enviar historial al usuario que se conecta
  socket.emit('chat:history', chatHistory);

  // Avisar a todos que entró alguien
  const joinMsg = { type: 'system', text: `${userName} se unió al chat`, time: Date.now() };
  io.emit('chat:message', joinMsg);

  // Actualizar lista de conectados
  io.emit('chat:online', Array.from(onlineUsers.values()));

  console.log(`💬 ${userName} conectado al chat (${onlineUsers.size} online)`);

  // Recibir mensaje
  socket.on('chat:send', (text) => {
    if (!text || typeof text !== 'string') return;
    const clean = text.trim().slice(0, 500); // max 500 chars
    if (!clean) return;

    const msg = { type: 'user', name: userName, userId, text: clean, time: Date.now() };
    chatHistory.push(msg);
    if (chatHistory.length > 50) chatHistory.shift(); // solo últimos 50

    io.emit('chat:message', msg); // broadcast a todos
  });

  // Desconexión
  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id);
    const leaveMsg = { type: 'system', text: `${userName} salió del chat`, time: Date.now() };
    io.emit('chat:message', leaveMsg);
    io.emit('chat:online', Array.from(onlineUsers.values()));
    console.log(`👋 ${userName} desconectado (${onlineUsers.size} online)`);
  });
});


app.post('/api/contact', async (req, res) => {
  const { name, email, subject, message } = req.body;

  try {

    const data = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'soytudadypool@gmail.com',
      replyTo: email,
      subject: `Consulta Web: ${subject}`,
      html: `
        <h2>Nueva consulta desde IroniPool</h2>

        <p><strong>Nombre:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Asunto:</strong> ${subject}</p>

        <hr>

        <p>${message}</p>
      `
    });

    console.log(data);

    res.json({
      success: true
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      error: error.message
    });

  }
});
    
// CREA EL TICKET PARA LOS SORTEOS
app.post('/api/raffle', (req, res) => {
  const { name, email } = req.body;

  const db = loadDB();

  // Si el array no existe, lo crea
  db.raffles = db.raffles || [];

  console.log("DB:", db);
  console.log("RAFFLES:", db.raffles);


  // Buscar si ya participa
  const exists = db.raffles.find(
    p => p.email === email
  );

  if (exists) {
    return res.status(400).json({
      success: false,
      error: 'Ya estás participando',
      ticket: exists.ticket
    });
  }

  const ticket = db.raffles.length + 1;

  const participant = {
    ticket,
    name,
    email,
    createdAt: new Date()
  };

  db.raffles.push(participant);

  saveDB(db);

  res.json({
    success: true,
    ticket
  });
});



// ── SPA fallback ───────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

console.log("__dirname =", __dirname);

console.log(
  "INDEX:",
  fs.existsSync(path.join(__dirname, '..', 'public', 'index.html'))
);

console.log(
  "PRODUCTS:",
  fs.existsSync(path.join(__dirname, '..', 'data', 'products', 'products.json'))
);

console.log(
  "DB:",
  fs.existsSync(path.join(__dirname, 'data', 'db.json'))
);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
});

