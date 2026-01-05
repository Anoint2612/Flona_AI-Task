const { processIngestion } = require('../services/ingest.service');

const ingestVideo = async (req, res) => {
    try {
        const payload = req.body;

        // Basic Validation
        if (!payload.a_roll || !payload.a_roll.url) {
            return res.status(400).json({ error: 'Invalid payload: a_roll.url is required' });
        }

        const result = await processIngestion(payload);
        res.status(200).json(result);
    } catch (error) {
        console.error('Ingestion error:', error);
        res.status(500).json({ error: 'Ingestion failed', details: error.message });
    }
};

module.exports = {
    ingestVideo,
};
