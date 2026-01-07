const fs = require('fs').promises;
const path = require('path');

const computeCosineSimilarity = (vecA, vecB) => {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    // Assuming vectors are already normalized by the Python service
    return dotProduct;
};

const splitLongSegments = (segments) => {
    const SPLIT_THRESHOLD = 10; // Split segments longer than 10 seconds
    const CHUNK_SIZE = 6; // Create 6-second chunks

    const result = [];

    segments.forEach(segment => {
        const duration = segment.end - segment.start;

        if (duration <= SPLIT_THRESHOLD) {
            // Keep segment as-is
            result.push(segment);
        } else {
            // Split into chunks
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
                    text: segment.text, // Same text and embedding
                    embedding: segment.embedding,
                    originalSegmentId: segment.id
                });
            }
        }
    });

    return result;
};

const generateMatchingPlan = async (assetDir) => {
    const vectorStorePath = path.join(assetDir, 'vector_store.json');
    const manifestPath = path.join(assetDir, 'manifest.json');

    try {
        const vectorData = JSON.parse(await fs.readFile(vectorStorePath, 'utf8'));
        const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

        const { transcriptSegments: originalSegments, brolls } = vectorData;
        const aRollDuration = manifest.a_roll.technical_metadata.duration;

        // Split long segments into smaller chunks
        const transcriptSegments = splitLongSegments(originalSegments);

        console.log(`Original segments: ${originalSegments.length}, After splitting: ${transcriptSegments.length}`);

        const matches = [];

        // 1. Compute similarities
        transcriptSegments.forEach(segment => {
            // Skip if segment starts in first 5 seconds or if insertion would go beyond last 5 seconds
            // We assume insertion duration is 3 seconds
            const insertionEnd = segment.start + 3;

            if (segment.start < 5 || insertionEnd > aRollDuration - 5) {
                return;
            }

            const segmentMatches = brolls.map(broll => ({
                broll_id: broll.id,
                similarity_score: computeCosineSimilarity(segment.embedding, broll.embedding),
                segment_start: segment.start,
                segment_end: segment.end,
                segment_id: segment.id
            }));

            // Sort by similarity
            segmentMatches.sort((a, b) => b.similarity_score - a.similarity_score);

            // Take top match for this segment
            if (segmentMatches.length > 0) {
                matches.push(segmentMatches[0]);
            }
        });

        // 2. Select final insertions with constraints
        // Sort all potential matches by score
        matches.sort((a, b) => b.similarity_score - a.similarity_score);

        const plan = [];
        const usedBrolls = new Set();
        const usedTimeRanges = [];

        for (const match of matches) {
            if (plan.length >= 5) break; // Max 5 insertions

            const duration = 3; // Fixed 3 seconds
            const start = match.segment_start;
            const end = start + duration;

            // Check overlap and gap constraints
            const hasConflict = usedTimeRanges.some(range => {
                // Check for overlap
                const overlap = Math.max(0, Math.min(end, range.end) - Math.max(start, range.start));
                if (overlap > 0) return true;

                // Check for minimum 3 seconds gap
                const gapBefore = start - range.end;
                const gapAfter = range.start - end;

                // If it's too close to an existing range (less than 3s gap)
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
                    matched_segment: match.segment_id
                });

                usedBrolls.add(match.broll_id);
                usedTimeRanges.push({ start, end });
            }
        }

        // Sort plan by start time
        plan.sort((a, b) => a.start_sec - b.start_sec);

        console.log(`Generated plan with ${plan.length} insertions`);

        // Save plan
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
