import { getFullGraph, getNode, searchConcepts } from '../server/ai/knowledgeEngine.js';
import { explainConcept } from '../server/ai/gemini.js';
import { getProgressMap, initDB } from '../server/db/database.js';
import { initGemini } from '../server/ai/gemini.js';
import url from 'url';

export default async function handler(req, res) {
    // Initialize
    initDB();
    initGemini();

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    if (req.method === 'GET' && pathname === '/graph') {
        try {
            const { userId = 'default' } = parsedUrl.query;
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
    } else if (req.method === 'GET' && pathname.startsWith('/node/')) {
        try {
            const id = pathname.split('/')[2];
            const node = getNode(id);
            if (!node) {
                return res.status(404).json({ error: 'Node not found' });
            }

            // Get AI explanation if available
            const progressMap = getProgressMap(parsedUrl.query.userId || 'default');
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
    } else if (req.method === 'POST' && pathname === '/search') {
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
    } else {
        res.status(404).json({ error: 'Not found' });
    }
}