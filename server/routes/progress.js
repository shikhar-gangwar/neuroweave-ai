import { Router } from 'express';
import {
    getOrCreateUser, getProgressMap, updateTopicProgress,
    completeLearningStep, getCompletedSteps, getRecentInteractions,
} from '../db/database.js';
import { getSkillData, generateLearningPath } from '../ai/knowledgeEngine.js';
import { generateLearningRecommendations } from '../ai/gemini.js';

const router = Router();

// Get user progress & skill data
router.get('/:userId', (req, res) => {
    try {
        const { userId } = req.params;
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
});

// Update mastery for a topic
router.post('/:userId/update', (req, res) => {
    try {
        const { userId } = req.params;
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
});

// Get adaptive learning path
router.get('/:userId/learning-path', async (req, res) => {
    try {
        const { userId } = req.params;
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
});

// Mark learning step complete
router.post('/:userId/complete', (req, res) => {
    try {
        const { userId } = req.params;
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
});

export default router;
