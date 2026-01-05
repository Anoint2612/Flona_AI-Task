const express = require('express');
const { getHealth } = require('../controllers/health.controller');
const { ingestVideo } = require('../controllers/ingest.controller');

const router = express.Router();

router.get('/health', getHealth);
router.post('/ingest', ingestVideo);

module.exports = router;
