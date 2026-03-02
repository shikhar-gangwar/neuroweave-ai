import { Router } from 'express';
import { getFullGraph, getNode, searchConcepts } from '../ai/knowledgeEngine.js';
import { explainConcept } from '../ai/gemini.js';
import { getProgressMap } from '../db/database.js';

const router = Router();

// Get full knowledge graph
router.get('/graph', (req, res) => {
    try {
        const { userId = 'default' } = req.query;
        const progressMap = getProgressMap(userId);
        const graph = getFullGraph();

        // Override mastery with user's actual progress
        graph.nodes = graph.nodes.map(node => ({
            ...node,
            mastery: progressMap[node.id] !== undefined ? progressMap[node.id] : node.mastery,
        }));

        res.json(graph);
    } catch (err) {
        console.error('Knowledge graph error:', err);
        res.status(500).json({ error: 'Failed to fetch graph' });
    }
});

// Get single node details
router.get('/node/:id', async (req, res) => {
    try {
        const node = getNode(req.params.id);
        if (!node) {
            return res.status(404).json({ error: 'Node not found' });
        }

        // Get AI explanation if available
        const progressMap = getProgressMap(req.query.userId || 'default');
        const userMastery = progressMap[node.id] || node.mastery;
        const aiExplanation = await explainConcept(node.label, userMastery);

        res.json({
            ...node,
            mastery: userMastery,
            aiExplanation: aiExplanation?.explanation || null,
        });
    } catch (err) {
        console.error('Node detail error:', err);
        res.status(500).json({ error: 'Failed to fetch node' });
    }
});

// Search concepts
router.post('/search', (req, res) => {
    try {
        const { query } = req.body;
        if (!query) {
            return res.status(400).json({ error: 'Search query is required' });
        }
        const results = searchConcepts(query);
        res.json({ results, count: results.length });
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ error: 'Search failed' });
    }
});

export default router;
