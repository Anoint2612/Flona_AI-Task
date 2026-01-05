const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { getVideoMetadata } = require('../utils/video.utils');
const { extractAudio, transcribeAudio } = require('./stt.service');
const { generateEmbeddings } = require('./embedding.service');

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

    // Extract Metadata
    let aRollMetadata = null;
    const aRollPath = path.join(assetDir, 'a_roll.mp4');
    if (payload.a_roll && payload.a_roll.url) {
        aRollMetadata = await getVideoMetadata(aRollPath);

        // Perform Transcription for A-Roll
        try {
            const audioPath = path.join(assetDir, 'a_roll.mp3');
            await extractAudio(aRollPath, audioPath);
            const transcript = await transcribeAudio(audioPath);

            const transcriptPath = path.join(assetDir, 'transcript.json');
            await fs.writeFile(transcriptPath, JSON.stringify(transcript, null, 2));
        } catch (sttError) {
            console.error('Transcription failed:', sttError.message);
            // Continue without failing the whole ingestion
        }
    }

    const bRollsWithMetadata = [];
    if (payload.b_rolls && Array.isArray(payload.b_rolls)) {
        for (const broll of payload.b_rolls) {
            let metadata = null;
            if (broll.url && broll.id) {
                const brollPath = path.join(brollsDir, `${broll.id}.mp4`);
                metadata = await getVideoMetadata(brollPath);
            }
            bRollsWithMetadata.push({
                ...broll,
                technical_metadata: metadata
            });
        }
    }

    // Save manifest
    const manifestPath = path.join(assetDir, 'manifest.json');
    const manifestData = {
        asset_id: assetId,
        created_at: new Date().toISOString(),
        a_roll: {
            ...payload.a_roll,
            technical_metadata: aRollMetadata
        },
        b_rolls: bRollsWithMetadata
    };

    await fs.writeFile(manifestPath, JSON.stringify(manifestData, null, 2));

    // Generate Embeddings
    try {
        const textsToEmbed = [];
        const transcriptSegments = [];
        const bRollsForEmbedding = [];

        // 1. Prepare Transcript Sentences
        const transcriptPath = path.join(assetDir, 'transcript.json');
        try {
            const transcriptData = await fs.readFile(transcriptPath, 'utf8');
            const transcript = JSON.parse(transcriptData);

            if (Array.isArray(transcript)) {
                transcript.forEach(segment => {
                    textsToEmbed.push(segment.text);
                    transcriptSegments.push({ ...segment });
                });
            }
        } catch (err) {
            console.warn('No transcript found for embedding generation');
        }

        // 2. Prepare B-Roll Metadata
        if (payload.b_rolls && Array.isArray(payload.b_rolls)) {
            payload.b_rolls.forEach(broll => {
                if (broll.metadata && broll.id) {
                    textsToEmbed.push(broll.metadata);
                    bRollsForEmbedding.push({ id: broll.id, metadata: broll.metadata });
                }
            });
        }

        if (textsToEmbed.length > 0) {
            const embeddings = await generateEmbeddings(textsToEmbed);

            // Map embeddings back to data structures
            let offset = 0;

            // Map to Transcript Segments
            const transcriptWithEmbeddings = transcriptSegments.map((segment, index) => ({
                ...segment,
                embedding: embeddings[index]
            }));
            offset += transcriptSegments.length;

            // Map to B-Rolls
            const bRollsWithEmbeddings = bRollsForEmbedding.map((broll, index) => ({
                ...broll,
                embedding: embeddings[offset + index]
            }));

            const vectorStore = {
                transcriptSegments: transcriptWithEmbeddings,
                brolls: bRollsWithEmbeddings
            };

            const vectorStorePath = path.join(assetDir, 'vector_store.json');
            await fs.writeFile(vectorStorePath, JSON.stringify(vectorStore, null, 2));
        }
    } catch (embedError) {
        console.error('Embedding generation failed:', embedError.message);
        // Continue without failing ingestion
    }

    return { asset_id: assetId, status: 'completed' };
};

module.exports = {
    processIngestion,
};
