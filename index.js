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
    methods: ['GET', 'POST'],
  },
});

// Use environment PORT if available (Render needs this)
const PORT = process.env.PORT || 1308;

// Middleware
app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Logger
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.path}`);
  next();
});

// JWT secret key
const secretkey = crypto.randomBytes(32).toString('hex');

// MongoDB connection (from environment variable)
mongoose.connect(process.env.MONGODB_URI).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.log('MongoDB connection error:', err);
});

// Auth Middleware
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization token missing or invalid' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, secretkey);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Token verification failed' });
  }
};

// Start Server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// === API ROUTES ===

// Login
app.post('/login', async (req, res) => {
  try {
    const { UserName, Password } = req.body;
    const user = await User.findOne({ UserName });

    if (!user || user.Password !== Password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id }, secretkey);
    res.status(200).json({ token });
  } catch (error) {
    console.log('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

// Get current user
app.get('/user', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Create new patient
app.post('/patients', async (req, res) => {
  try {
    const newPatient = new Register(req.body);
    await newPatient.save();
    io.emit('new-patient', newPatient);
    res.status(201).json(newPatient);
  } catch (error) {
    res.status(500).json({ error: 'Error saving patient details' });
  }
});

// Get all patients for a doctor
app.get('/patients', async (req, res) => {
  try {
    const doctorID = req.query.doctorID;
    const patients = await Register.find({ doctorID });
    res.json(patients);
  } catch (error) {
    res.status(500).json({ error: 'Error retrieving patients' });
  }
});

// Delete patient
app.delete('/patients/:id', async (req, res) => {
  try {
    const patient = await Register.findByIdAndDelete(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    io.emit('delete-patient');
    res.sendStatus(204);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update patient
app.put('/patients/:patientId', async (req, res) => {
  try {
    const updated = await Register.findByIdAndUpdate(req.params.patientId, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Patient not found' });
    res.json({ message: 'Patient updated successfully', updatedPatient: updated });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update patient' });
  }
});

// Add drug
app.post('/drugs', async (req, res) => {
  try {
    const newDrug = new Drugs(req.body);
    await newDrug.save();
    io.emit('new-drug', newDrug);
    res.status(201).json(newDrug);
  } catch (error) {
    res.status(500).json({ error: 'Error saving drug details' });
  }
});

// Get all drugs
app.get('/drugs', async (req, res) => {
  try {
    const drugs = await Drugs.find();
    res.json(drugs);
  } catch (error) {
    res.status(500).json({ error: 'Error retrieving drugs' });
  }
});
app.get('/privacy-policy', (req, res) => {
  res.sendFile(path.join(__dirname, 'privacy-policy.html'));
});

// Reset password
app.post('/reset-password/:doctorID', async (req, res) => {
  try {
    const { newPassword } = req.body;
    const updated = await User.findOneAndUpdate({ doctorID: req.params.doctorID }, { Password: newPassword }, { new: true });
    if (!updated) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});
// Serve the form
app.get('/delete-account', (req, res) => {
  res.sendFile(path.join(__dirname, 'account-delete-form.html'));
});

// Handle form submission
app.post('/delete-account-form', async (req, res) => {
  const { email, confirm } = req.body;

  if (confirm !== 'DELETE') {
    return res.status(400).send('You must type DELETE to confirm.');
  }

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).send('No user found with that email.');

    // Delete patient records first
    await Patient.deleteMany({ userId: user._id });

    // Then delete the user account
    await User.deleteOne({ _id: user._id });

    res.send('Your account and all related data have been permanently deleted.');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting account. Please try again later.');
  }
});

module.exports = app;
