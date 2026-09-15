'use strict';

const express  = require('express');
const mongoose = require('mongoose');

const router = express.Router();

const DB_STATES = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

router.get('/', (req, res) => {
  const state = mongoose.connection.readyState;
  res.json({
    status: 'ok',
    db:     DB_STATES[state] || 'unknown',
    time:   new Date().toISOString()
  });
});

module.exports = router;
