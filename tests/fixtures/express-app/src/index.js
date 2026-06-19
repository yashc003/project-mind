const express = require('express');
const app = express();
const userRoutes = require('./routes/userRoutes');

app.use('/api', userRoutes);

app.get('/health', (req, res) => res.send('OK'));

