const fs = require('fs').promises;
const path = require('path');

const computeCosineSimilarity = (vecA, vecB) => {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    return dotProduct;
};

const splitLongSegments = (segments) => {
    const SPLIT_THRESHOLD = 10;
    const CHUNK_SIZE = 6;

    const result = [];

    segments.forEach(segment => {
        const duration = segment.end - segment.start;

        if (duration <= SPLIT_THRESHOLD) {
            result.push(segment);
        } else {
            const numChunks = Math.ceil(duration / CHUNK_SIZE);
            const actualChunkSize = duration / numChunks;

            for (let i = 0; i < numChunks; i++) {
                const chunkStart = segment.start + (i * actualChunkSize);
                const chunkEnd = i === numChunks - 1
                    ? segment.end
                    : segment.start + ((i + 1) * actualChunkSize);

                result.push({
                    id: `${segment.id}_chunk_${i}`,
                    start: chunkStart,
                    end: chunkEnd,
                    text: segment.text,
                    embedding: segment.embedding,
                    originalSegmentId: segment.id
                });
            }
        }
    });

    return result;
};

const generateExplanation = (segmentText, brollMetadata, similarityScore) => {
    const truncate = (text, maxLength = 80) => {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    };

    const scorePercent = (similarityScore * 100).toFixed(1);
    const truncatedSegment = truncate(segmentText);
    const truncatedBroll = truncate(brollMetadata);

    return `At this moment, the speaker says "${truncatedSegment}". Inserting B-roll "${truncatedBroll}" to visually support this content (${scorePercent}% match).`;
};

const generateMatchingPlan = async (assetDir) => {
    const vectorStorePath = path.join(assetDir, 'vector_store.json');
    const manifestPath = path.join(assetDir, 'manifest.json');

    try {
        const vectorData = JSON.parse(await fs.readFile(vectorStorePath, 'utf8'));
        const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

        const { transcriptSegments: originalSegments, brolls } = vectorData;
        const aRollDuration = manifest.a_roll.technical_metadata.duration;

        const transcriptSegments = splitLongSegments(originalSegments);

        console.log(`Original segments: ${originalSegments.length}, After splitting: ${transcriptSegments.length}`);

        const matches = [];

        transcriptSegments.forEach(segment => {
            const insertionEnd = segment.start + 3;

            if (segment.start < 5 || insertionEnd > aRollDuration - 5) {
                return;
            }

            const segmentMatches = brolls.map(broll => ({
                broll_id: broll.id,
                broll_metadata: broll.metadata,
                similarity_score: computeCosineSimilarity(segment.embedding, broll.embedding),
                segment_start: segment.start,
                segment_end: segment.end,
                segment_id: segment.id,
                segment_text: segment.text
            }));

            segmentMatches.sort((a, b) => b.similarity_score - a.similarity_score);

            if (segmentMatches.length > 0) {
                matches.push(segmentMatches[0]);
            }
        });

        matches.sort((a, b) => b.similarity_score - a.similarity_score);

        const plan = [];
        const usedBrolls = new Set();
        const usedTimeRanges = [];

        for (const match of matches) {
            if (plan.length >= 5) break;

            const duration = 3;
            const start = match.segment_start;
            const end = start + duration;

            const hasConflict = usedTimeRanges.some(range => {
                const overlap = Math.max(0, Math.min(end, range.end) - Math.max(start, range.start));
                if (overlap > 0) return true;

                const gapBefore = start - range.end;
                const gapAfter = range.start - end;

                if ((gapBefore >= 0 && gapBefore < 3) || (gapAfter >= 0 && gapAfter < 3)) {
                    return true;
                }

                return false;
            });

            if (!hasConflict) {
                plan.push({
                    start_sec: start,
                    duration_sec: duration,
                    broll_id: match.broll_id,
                    similarity_score: match.similarity_score,
                    matched_segment: match.segment_id,
                    explanation: generateExplanation(
                        match.segment_text,
                        match.broll_metadata,
                        match.similarity_score
                    )
                });

                usedBrolls.add(match.broll_id);
                usedTimeRanges.push({ start, end });
            }
        }

        plan.sort((a, b) => a.start_sec - b.start_sec);

        console.log(`Generated plan with ${plan.length} insertions`);

        const planPath = path.join(assetDir, 'plan.json');
        await fs.writeFile(planPath, JSON.stringify(plan, null, 2));

        return plan;

    } catch (error) {
        console.error('Error generating matching plan:', error);
        throw error;
    }
};

module.exports = {
    generateMatchingPlan
};
