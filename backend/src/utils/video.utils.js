const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const getVideoMetadata = (filePath) => {
    return new Promise((resolve) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                console.error(`Error getting metadata for ${filePath}:`, err);
                // Return null instead of rejecting to fail gracefully
                return resolve(null);
            }

            try {
                const videoStream = metadata.streams.find(s => s.codec_type === 'video');
                const format = metadata.format;

                if (!videoStream) {
                    return resolve(null);
                }

                const { width, height, r_frame_rate } = videoStream;
                const duration = format.duration || videoStream.duration;

                // Calculate FPS
                let fps = 0;
                if (r_frame_rate) {
                    const parts = r_frame_rate.split('/');
                    if (parts.length === 2) {
                        fps = parseFloat(parts[0]) / parseFloat(parts[1]);
                    } else {
                        fps = parseFloat(r_frame_rate);
                    }
                }

                resolve({
                    duration: parseFloat(duration),
                    resolution: `${width}x${height}`,
                    fps: Math.round(fps * 100) / 100
                });
            } catch (e) {
                console.error('Error parsing metadata:', e);
                resolve(null);
            }
        });
    });
};

module.exports = {
    getVideoMetadata
};
