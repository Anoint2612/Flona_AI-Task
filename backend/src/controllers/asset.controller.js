const fs = require('fs').promises;
const path = require('path');

const STORAGE_DIR = path.join(__dirname, '../../storage');

const getAssetFile = async (req, res) => {
    try {
        const { assetId, fileType } = req.params;
        const filePath = path.join(STORAGE_DIR, assetId, `${fileType}.json`);

        const data = await fs.readFile(filePath, 'utf8');
        const jsonData = JSON.parse(data);

        res.json(jsonData);
    } catch (error) {
        console.error('Error reading asset file:', error);
        res.status(404).json({ error: 'File not found' });
    }
};

module.exports = {
    getAssetFile
};
