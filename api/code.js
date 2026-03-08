import { analyzeCode, analyzeProject, getFileHelp, reviewProject, generateReadme, explainError, initGemini } from '../server/ai/gemini.js';
import { fileTree, codeSnippets, aiAnnotations } from '../server/data/codeData.js';
import url from 'url';

export default async function handler(req, res) {
    initGemini();

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const parts = pathname.split('/').filter(p => p);

    if (req.method === 'POST' && pathname === '/analyze') {
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
    } else if (req.method === 'POST' && pathname === '/explain') {
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
    } else if (req.method === 'POST' && pathname === '/project-analyze') {
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
    } else if (req.method === 'POST' && pathname === '/project-file-help') {
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
    } else if (req.method === 'GET' && pathname === '/files') {
        res.json({ fileTree });
    } else if (req.method === 'GET' && parts.length === 2 && parts[0] === 'sample') {
        const fileId = parts[1];
        const snippet = codeSnippets[fileId];

        if (!snippet) {
            return res.status(404).json({ error: 'File not found' });
        }

        res.json({
            filename: fileId,
            ...snippet,
            annotations: aiAnnotations[fileId] || [],
        });
    } else if (req.method === 'POST' && pathname === '/project-review') {
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
    } else if (req.method === 'POST' && pathname === '/generate-readme') {
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
    } else if (req.method === 'POST' && pathname === '/explain-error') {
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
    } else {
        res.status(404).json({ error: 'Not found' });
    }
}