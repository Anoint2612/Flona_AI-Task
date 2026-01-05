const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const STORAGE_DIR = path.join(__dirname, '../../storage');

const downloadFile = async (url, filePath) => {
    const writer = (await fs.open(filePath, 'w')).createWriteStream();
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
};

// Helper to download file using fs.writeFile for simpler async handling with buffers if stream is tricky, 
// but stream is better for large files. Let's stick to stream but handle directory creation carefully.
const downloadVideo = async (url, destPath) => {
    try {
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream'
        });

        // Ensure directory exists (redundant if handled by caller, but safe)
        await fs.mkdir(path.dirname(destPath), { recursive: true });

        // We need to use fs.createWriteStream from 'fs' not 'fs.promises'
        const fileStream = require('fs').createWriteStream(destPath);

        return new Promise((resolve, reject) => {
            response.data.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close();
                resolve();
            });
            fileStream.on('error', (err) => {
                // Delete the file if error occurs
                fs.unlink(destPath).catch(() => { });
                reject(err);
            });
        });
    } catch (error) {
        throw new Error(`Failed to download ${url}: ${error.message}`);
    }
};

const processIngestion = async (payload) => {
    const assetId = uuidv4();
    const assetDir = path.join(STORAGE_DIR, assetId);
    const brollsDir = path.join(assetDir, 'brolls');

    // Create directories
    await fs.mkdir(assetDir, { recursive: true });
    await fs.mkdir(brollsDir, { recursive: true });

    const downloads = [];

    // Download A-Roll
    if (payload.a_roll && payload.a_roll.url) {
        const aRollPath = path.join(assetDir, 'a_roll.mp4');
        downloads.push(downloadVideo(payload.a_roll.url, aRollPath));
    }

    // Download B-Rolls
    if (payload.b_rolls && Array.isArray(payload.b_rolls)) {
        payload.b_rolls.forEach((broll) => {
            if (broll.url && broll.id) {
                const brollPath = path.join(brollsDir, `${broll.id}.mp4`);
                downloads.push(downloadVideo(broll.url, brollPath));
            }
        });
    }

    // Wait for all downloads
    try {
        await Promise.all(downloads);
    } catch (error) {
        // Cleanup on failure could be implemented here
        console.error('Download failed:', error);
        throw error;
    }

    // Save manifest
    const manifestPath = path.join(assetDir, 'manifest.json');
    const manifestData = {
        asset_id: assetId,
        created_at: new Date().toISOString(),
        ...payload
    };

    await fs.writeFile(manifestPath, JSON.stringify(manifestData, null, 2));

    return { asset_id: assetId, status: 'completed' };
};

module.exports = {
    processIngestion,
};
