const express = require('express');
const app = express();
const router = express.Router();

app.get('/health', (req, res) => res.send('OK'));
app.post('/api/data', (req, res) => res.send('Data'));

router.put('/users/:id', (req, res) => res.send('User'));
router.delete('/users/:id', (req, res) => res.send('Deleted'));
