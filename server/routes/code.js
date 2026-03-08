import { Router } from 'express';
import { analyzeCode, analyzeProject, getFileHelp, reviewProject, generateReadme, explainError } from '../ai/gemini.js';
import { fileTree, codeSnippets, aiAnnotations } from '../data/codeData.js';

const router = Router();

// AI code analysis
router.post('/analyze', async (req, res) => {
    try {
        const { code, language = 'javascript' } = req.body;

        if (!code || typeof code !== 'string') {
            return res.status(400).json({ error: 'Code is required' });
        }

        const analysis = await analyzeCode(code, language, 'analyze');
        res.json(analysis);
    } catch (err) {
        console.error('Code analysis error:', err);
        res.status(500).json({ error: 'Failed to analyze code' });
    }
});

// AI code explanation
router.post('/explain', async (req, res) => {
    try {
        const { code, language = 'javascript' } = req.body;

        if (!code || typeof code !== 'string') {
            return res.status(400).json({ error: 'Code is required' });
        }

        const explanation = await analyzeCode(code, language, 'explain');
        res.json(explanation);
    } catch (err) {
        console.error('Code explain error:', err);
        res.status(500).json({ error: 'Failed to explain code' });
    }
});

// Analyze entire project structure
router.post('/project-analyze', async (req, res) => {
    try {
        const { files, structure } = req.body;

        if (!files || !Array.isArray(files) || !structure) {
            return res.status(400).json({ error: 'Project files and structure are required' });
        }

        console.log(`📂 Analyzing project: ${files.length} files`);
        const result = await analyzeProject({ files, structure });
        res.json(result);
    } catch (err) {
        console.error('Project analysis error:', err);
        res.status(500).json({ error: 'Failed to analyze project' });
    }
});

// Get contextual help for a specific file within a project
router.post('/project-file-help', async (req, res) => {
    try {
        const { code, language = 'javascript', projectContext = '', question = '' } = req.body;

        if (!code || typeof code !== 'string') {
            return res.status(400).json({ error: 'Code is required' });
        }

        console.log(`🔍 File help: ${language} | Q: ${question?.slice(0, 50) || 'analyze'}`);
        const result = await getFileHelp(code, language, projectContext, question);
        res.json(result);
    } catch (err) {
        console.error('File help error:', err);
        res.status(500).json({ error: 'Failed to get file help' });
    }
});

// Get sample file tree
router.get('/files', (req, res) => {
    res.json({ fileTree });
});

// Get sample file content
router.get('/sample/:fileId', (req, res) => {
    const { fileId } = req.params;
    const snippet = codeSnippets[fileId];

    if (!snippet) {
        return res.status(404).json({ error: 'File not found' });
    }

    res.json({
        filename: fileId,
        ...snippet,
        annotations: aiAnnotations[fileId] || [],
    });
});

// PR-style code review
router.post('/project-review', async (req, res) => {
    try {
        const { files, structure } = req.body;

        if (!files || !Array.isArray(files) || !structure) {
            return res.status(400).json({ error: 'Project files and structure are required' });
        }

        console.log(`🔍 Code review: ${files.length} files`);
        const result = await reviewProject({ files, structure });
        res.json(result);
    } catch (err) {
        console.error('Code review error:', err);
        res.status(500).json({ error: 'Failed to review code' });
    }
});

// Auto README generator
router.post('/generate-readme', async (req, res) => {
    try {
        const { files, structure } = req.body;
        if (!files || !Array.isArray(files) || !structure) {
            return res.status(400).json({ error: 'Project files and structure are required' });
        }
        console.log(`📝 Generating README for ${files.length} files`);
        const result = await generateReadme({ files, structure });
        res.json(result);
    } catch (err) {
        console.error('README generation error:', err);
        res.status(500).json({ error: 'Failed to generate README' });
    }
});

// Error explainer
router.post('/explain-error', async (req, res) => {
    try {
        const { errorText, language } = req.body;
        if (!errorText || !errorText.trim()) {
            return res.status(400).json({ error: 'Error text is required' });
        }
        console.log(`🐛 Explaining error (${language || 'auto'})`);
        const result = await explainError(errorText, language);
        res.json(result);
    } catch (err) {
        console.error('Error explanation error:', err);
        res.status(500).json({ error: 'Failed to explain error' });
    }
});

export default router;

