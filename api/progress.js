import {
    getOrCreateUser, getProgressMap, updateTopicProgress,
    completeLearningStep, getCompletedSteps, getRecentInteractions, initDB
} from '../server/db/database.js';
import { getSkillData, generateLearningPath } from '../server/ai/knowledgeEngine.js';
import { generateLearningRecommendations, initGemini } from '../server/ai/gemini.js';
import url from 'url';

export default async function handler(req, res) {
    initDB();
    initGemini();

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const parts = pathname.split('/').filter(p => p);

    if (req.method === 'GET' && parts.length === 1) {
        // GET /:userId
        try {
            const userId = parts[0];
            getOrCreateUser(userId);

            const progressMap = getProgressMap(userId);
            const skillData = getSkillData(progressMap);
            const recentInteractions = getRecentInteractions(userId, 10);

            res.json({
                ...skillData,
                recentInteractions: recentInteractions.map(i => ({
                    query: i.query,
                    summary: i.response_summary,
                    source: i.source,
                    timestamp: i.created_at,
                })),
            });
        } catch (err) {
            console.error('Progress fetch error:', err);
            res.status(500).json({ error: 'Failed to fetch progress' });
        }
    } else if (req.method === 'POST' && parts.length === 2 && parts[1] === 'update') {
        // POST /:userId/update
        try {
            const userId = parts[0];
            const { topicId, delta = 5 } = req.body;

            if (!topicId) {
                return res.status(400).json({ error: 'topicId is required' });
            }

            getOrCreateUser(userId);
            const newMastery = updateTopicProgress(userId, topicId, delta);

            res.json({ topicId, mastery: newMastery });
        } catch (err) {
            console.error('Progress update error:', err);
            res.status(500).json({ error: 'Failed to update progress' });
        }
    } else if (req.method === 'GET' && parts.length === 2 && parts[1] === 'learning-path') {
        // GET /:userId/learning-path
        try {
            const userId = parts[0];
            getOrCreateUser(userId);

            const progressMap = getProgressMap(userId);
            const completedSteps = getCompletedSteps(userId);
            const path = generateLearningPath(progressMap);

            // Mark completed steps
            const enrichedPath = path.map(step => ({
                ...step,
                completed: completedSteps.includes(step.id),
                current: !completedSteps.includes(step.id) && step.current,
            }));

            // Get AI recommendations if possible
            const skillData = getSkillData(progressMap);
            const aiRecs = await generateLearningRecommendations(skillData.weakAreas, skillData.skills);

            res.json({
                path: enrichedPath,
                totalSteps: enrichedPath.length,
                completedCount: completedSteps.length,
                aiRecommendations: aiRecs?.recommendations || null,
            });
        } catch (err) {
            console.error('Learning path error:', err);
            res.status(500).json({ error: 'Failed to generate learning path' });
        }
    } else if (req.method === 'POST' && parts.length === 2 && parts[1] === 'complete') {
        // POST /:userId/complete
        try {
            const userId = parts[0];
            const { topicId } = req.body;

            if (!topicId) {
                return res.status(400).json({ error: 'topicId is required' });
            }

            getOrCreateUser(userId);
            completeLearningStep(userId, topicId);

            // Return updated progress
            const progressMap = getProgressMap(userId);
            const skillData = getSkillData(progressMap);

            res.json({
                completed: true,
                topicId,
                updatedSkills: skillData,
            });
        } catch (err) {
            console.error('Complete step error:', err);
            res.status(500).json({ error: 'Failed to complete step' });
        }
    } else {
        res.status(404).json({ error: 'Not found' });
    }
}