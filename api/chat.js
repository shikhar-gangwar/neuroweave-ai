import { chat as geminiChat, initGemini } from '../server/ai/gemini.js';
import { getSkillData } from '../server/ai/knowledgeEngine.js';
import { logInteraction, bulkUpdateProgress, getProgressMap, initDB } from '../server/db/database.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Initialize DB and Gemini if not already
        initDB();
        initGemini();

        const { query, userId = 'default' } = req.body;

        if (!query || typeof query !== 'string' || query.trim().length === 0) {
            return res.status(400).json({ error: 'Query is required' });
        }

        // Get user's current skill context
        const progressMap = getProgressMap(userId);
        const skillData = getSkillData(progressMap);

        // Send to Gemini with context
        const response = await geminiChat(query.trim(), {
            skills: skillData.skills,
            weakAreas: skillData.weakAreas,
        });

        // Update progress for related topics
        if (response.relatedTopics && response.relatedTopics.length > 0) {
            bulkUpdateProgress(userId, response.relatedTopics, 2);
        }

        // Log interaction
        logInteraction(userId, query, response.title, response.relatedTopics, 'chat');

        res.json(response);
    } catch (err) {
        console.error('Chat route error:', err);
        res.status(500).json({ error: 'Failed to process query' });
    }
}