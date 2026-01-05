const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', routes);

// 404 Handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

module.exports = app;
