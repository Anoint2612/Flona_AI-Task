const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');
const fs = require('fs').promises;

ffmpeg.setFfmpegPath(ffmpegPath);

const renderVideo = async (assetDir) => {
    const planPath = path.join(assetDir, 'plan.json');
    const aRollPath = path.join(assetDir, 'a_roll.mp4');
    const bRollsDir = path.join(assetDir, 'brolls');
    const outputPath = path.join(assetDir, 'final_video.mp4');

    try {
        const plan = JSON.parse(await fs.readFile(planPath, 'utf8'));

        if (!plan || plan.length === 0) {
            console.log('No B-rolls to insert. Copying A-roll to final video.');
            await fs.copyFile(aRollPath, outputPath);
            return outputPath;
        }

        return new Promise((resolve, reject) => {
            const command = ffmpeg();

            command.input(aRollPath);

            plan.forEach(item => {
                const bRollPath = path.join(bRollsDir, `${item.broll_id}.mp4`);
                command.input(bRollPath);
            });

            let filterComplex = [];
            let lastStream = '0:v';

            plan.forEach((item, index) => {
                const bRollInputIndex = index + 1;
                const scaledBRoll = `scaled_broll_${index}`;
                const delayedBRoll = `delayed_broll_${index}`;
                const start = item.start_sec;
                const end = item.start_sec + item.duration_sec;

                filterComplex.push(`[${bRollInputIndex}:v][0:v]scale2ref=w=iw:h=ih:force_original_aspect_ratio=increase,crop=iw:ih[${scaledBRoll}]`);

                filterComplex.push(`[${scaledBRoll}]setpts=PTS-STARTPTS+${start}/TB[${delayedBRoll}]`);

                const nextStream = `v${index}`;
                filterComplex.push(`[${lastStream}][${delayedBRoll}]overlay=enable='between(t,${start},${end})':eof_action=pass[${nextStream}]`);

                lastStream = nextStream;
            });

            command.complexFilter(filterComplex);
            command.outputOptions(['-map', `[${lastStream}]`, '-map', '0:a']);

            command
                .on('start', (cmdLine) => {
                    console.log('FFmpeg command:', cmdLine);
                })
                .on('end', () => {
                    console.log('Rendering finished successfully');
                    resolve(outputPath);
                })
                .on('error', (err) => {
                    console.error('Rendering failed:', err);
                    reject(err);
                })
                .save(outputPath);
        });

    } catch (error) {
        console.error('Error rendering video:', error);
        throw error;
    }
};

module.exports = {
    renderVideo
};
