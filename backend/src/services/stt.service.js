const ffmpeg = require('fluent-ffmpeg');
const { AssemblyAI } = require('assemblyai');

const client = new AssemblyAI({
    apiKey: process.env.STT_API_KEY,
});

const extractAudio = (videoPath, audioPath) => {
    return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .toFormat('mp3')
            .on('end', () => resolve(audioPath))
            .on('error', (err) => reject(err))
            .save(audioPath);
    });
};

const transcribeAudio = async (audioPath) => {
    try {
        const params = {
            audio: audioPath,
            speech_model: 'best',
        };

        const transcript = await client.transcripts.transcribe(params);

        if (transcript.status === 'error') {
            throw new Error(transcript.error);
        }

        // Get sentence-level timestamps
        const sentences = await client.transcripts.getSentences(transcript.id);

        if (sentences && sentences.sentences) {
            return sentences.sentences.map((sent, index) => ({
                id: index,
                start: sent.start / 1000, // AssemblyAI uses ms
                end: sent.end / 1000,
                text: sent.text
            }));
        }

        return [];
    } catch (error) {
        console.error('STT API Error:', error);
        throw new Error('Transcription failed');
    }
};

module.exports = {
    extractAudio,
    transcribeAudio
};
