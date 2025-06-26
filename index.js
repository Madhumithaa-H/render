const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const User = require('./models/user');
const Register = require('./models/register');
const Drugs = require('./models/Drug');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// 🔐 Secret Key for JWT
const secretkey = crypto.randomBytes(32).toString('hex');

// 🌍 Environment
const PORT = process.env.PORT || 1308;
const SOCKET_PORT = process.env.SOCKET_PORT || 8080;
const MONGODB_URI = process.env.MONGODB_URI || 'your_mongodb_uri_here';

// 🛡️ Middleware
app.use(cors({ origin: '*', methods: 'GET,POST' }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// 🩺 Health check (for Render cold start)
app.get('/ping', (req, res) => {
  res.send('Server is alive');
});

// 🔐 Auth Middleware
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token missing or invalid' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, secretkey);
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ message: 'Token verification failed' });
  }
};

// 🧠 MongoDB Connection
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// 📋 Logger
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.path}`);
  next();
});

// 🔐 Login
app.post('/login', async (req, res) => {
  try {
    const { UserName, Password } = req.body;
    const user = await User.findOne({ UserName });
    if (!user || user.Password !== Password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user._id }, secretkey, { expiresIn: '24h' });
    res.status(200).json({ token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

// 👤 Get User Info
app.get('/user', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ➕ Add Patient
app.post('/patients', async (req, res) => {
  try {
    const newPatient = new Register(req.body);
    await newPatient.save();
    io.emit('new-patient', newPatient);
    res.status(201).json(newPatient);
  } catch (err) {
    res.status(500).json({ error: 'Error saving patient details' });
  }
});

// 📥 Get All Patients for a Doctor
app.get('/patients', async (req, res) => {
  try {
    const doctorID = req.query.doctorID;
    const patients = await Register.find({ doctorID });
    res.json(patients);
  } catch (err) {
    res.status(500).json({ error: 'Error retrieving patients' });
  }
});

// ❌ Delete Patient
app.delete('/patients/:id', async (req, res) => {
  try {
    const patient = await Register.findByIdAndDelete(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    io.emit('delete-patient');
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ✏️ Update Patient
app.put('/patients/:patientId', async (req, res) => {
  try {
    const updated = await Register.findByIdAndUpdate(
      req.params.patientId,
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Patient not found' });
    res.json({ message: 'Patient updated successfully', updatedPatient: updated });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update patient' });
  }
});

// ➕ Add Drug
app.post('/drugs', async (req, res) => {
  try {
    const newDrug = new Drugs(req.body);
    await newDrug.save();
    io.emit('new-drug', newDrug);
    res.status(201).json(newDrug);
  } catch (err) {
    res.status(500).json({ error: 'Error saving drug details' });
  }
});

// 📥 Get All Drugs
app.get('/drugs', async (req, res) => {
  try {
    const drugs = await Drugs.find();
    res.json(drugs);
  } catch (err) {
    res.status(500).json({ error: 'Error retrieving drugs' });
  }
});

// 🔁 Reset Password
app.post('/reset-password/:doctorID', async (req, res) => {
  try {
    const { newPassword } = req.body;
    const updated = await User.findOneAndUpdate(
      { doctorID: req.params.doctorID },
      { Password: newPassword },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ✅ Start Express & Socket Servers
server.listen(PORT, () => {
  console.log(`Express server running on port ${PORT}`);
});

io.listen(SOCKET_PORT);
console.log(`Socket.IO server running on port ${SOCKET_PORT}`);
