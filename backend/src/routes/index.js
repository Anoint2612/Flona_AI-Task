const express = require('express');
const router = express.Router();
const { getHealth } = require('../controllers/health.controller');
const { ingestVideo } = require('../controllers/ingest.controller');
const { getAssetFile } = require('../controllers/asset.controller');

router.get('/health', getHealth);
router.post('/ingest', ingestVideo);
router.get('/asset/:assetId/:fileType', getAssetFile);

module.exports = router;
