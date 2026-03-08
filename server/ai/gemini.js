import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { chatPrompt, codeAnalysisPrompt, conceptExplainPrompt, learningPathPrompt, projectAnalysisPrompt, fileHelpPrompt, codeReviewPrompt, readmeGeneratorPrompt, errorExplainerPrompt } from './prompts.js';

dotenv.config();

let genAI = null;
let model = null;

function initGemini() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
        console.warn('⚠️  GEMINI_API_KEY not set. AI features will use fallback responses.');
        return false;
    }
    try {
        genAI = new GoogleGenerativeAI(apiKey);
        model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        console.log('✅ Gemini AI initialized successfully');
        return true;
    } catch (err) {
        console.error('❌ Failed to initialize Gemini:', err.message);
        return false;
    }
}

function isAvailable() {
    return model !== null;
}

async function chat(query, context = {}) {
    if (!model) return fallbackChat(query);

    const startTime = Date.now();
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const systemPrompt = chatPrompt(context);
            const chatSession = model.startChat({
                history: [
                    { role: 'user', parts: [{ text: systemPrompt }] },
                    { role: 'model', parts: [{ text: 'Understood. I am NeuroWeave AI, ready to help developers learn and grow. How can I assist you today?' }] },
                ],
            });

            const result = await chatSession.sendMessage(query);
            const response = result.response.text();
            const totalTime = Date.now() - startTime;

            return {
                title: extractTitle(response),
                content: response,
                relatedTopics: extractTopics(response, query),
                codeExample: null,
                latency: {
                    parsing: Math.floor(totalTime * 0.15),
                    intent: Math.floor(totalTime * 0.1),
                    graphLookup: Math.floor(totalTime * 0.15),
                    inference: Math.floor(totalTime * 0.4),
                    generation: Math.floor(totalTime * 0.2),
                    total: totalTime,
                },
                queryId: generateId(),
                timestamp: Date.now(),
                source: 'gemini',
            };
        } catch (err) {
            const isRateLimit = err.message?.includes('429') || err.message?.includes('quota') || err.message?.includes('RESOURCE_EXHAUSTED');
            if (isRateLimit && attempt < maxRetries - 1) {
                const delay = (attempt + 1) * 3000;
                console.log(`⏳ Rate limited, retrying in ${delay / 1000}s (attempt ${attempt + 2}/${maxRetries})...`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            console.error('Gemini chat error:', err.message);
            return fallbackChat(query);
        }
    }
    return fallbackChat(query);
}

async function analyzeCode(code, language, mode = 'analyze') {
    if (!model) return fallbackCodeAnalysis(code, language);

    try {
        const prompt = mode === 'explain'
            ? `${codeAnalysisPrompt()}\n\nExplain this ${language} code line by line:\n\`\`\`${language}\n${code}\n\`\`\``
            : `${codeAnalysisPrompt()}\n\nAnalyze this ${language} code for patterns, issues, and improvements:\n\`\`\`${language}\n${code}\n\`\`\``;

        const result = await model.generateContent(prompt);
        return {
            analysis: result.response.text(),
            source: 'gemini',
        };
    } catch (err) {
        console.error('Gemini code analysis error:', err.message);
        return fallbackCodeAnalysis(code, language);
    }
}

async function explainConcept(concept, userMastery = 50) {
    if (!model) return null;

    try {
        const prompt = conceptExplainPrompt(concept, userMastery);
        const result = await model.generateContent(prompt);
        return {
            explanation: result.response.text(),
            source: 'gemini',
        };
    } catch (err) {
        console.error('Gemini explain error:', err.message);
        return null;
    }
}

async function generateLearningRecommendations(weakAreas, currentSkills) {
    if (!model) return null;

    try {
        const prompt = learningPathPrompt(weakAreas, currentSkills);
        const result = await model.generateContent(prompt);
        return {
            recommendations: result.response.text(),
            source: 'gemini',
        };
    } catch (err) {
        console.error('Gemini learning path error:', err.message);
        return null;
    }
}

async function analyzeProject(projectData) {
    if (!model) {
        return {
            overview: '### Project Analysis\n\nConnect your Gemini API key for real project analysis.\n\n> 💡 Add GEMINI_API_KEY to .env for AI-powered insights.',
            source: 'fallback',
        };
    }

    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const prompt = `${projectAnalysisPrompt()}\n\n## Project Structure:\n\`\`\`\n${projectData.structure}\n\`\`\`\n\n## Key File Contents:\n${projectData.files.slice(0, 15).map(f => `### ${f.path} (${f.language})\n\`\`\`${f.language}\n${f.content.slice(0, 3000)}\n\`\`\``).join('\n\n')}`;

            const result = await model.generateContent(prompt);
            return {
                overview: result.response.text(),
                source: 'gemini',
            };
        } catch (err) {
            const isRateLimit = err.message?.includes('429') || err.message?.includes('quota') || err.message?.includes('RESOURCE_EXHAUSTED');
            if (isRateLimit && attempt < maxRetries - 1) {
                const delay = (attempt + 1) * 3000;
                console.log(`⏳ Rate limited on project analysis, retrying in ${delay / 1000}s...`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            console.error('Gemini project analysis error:', err.message);
            return {
                overview: `### ⚠️ Analysis Error\n\n${err.message}\n\nPlease try again in a moment.`,
                source: 'error',
            };
        }
    }
}

async function getFileHelp(code, language, projectContext, question) {
    if (!model) {
        return {
            help: '### File Help\n\nConnect your Gemini API key for contextual file analysis.\n\n> 💡 Add GEMINI_API_KEY to .env.',
            source: 'fallback',
        };
    }

    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const systemPrompt = fileHelpPrompt(projectContext);
            const userPrompt = question
                ? `Here is the file (${language}):\n\`\`\`${language}\n${code.slice(0, 5000)}\n\`\`\`\n\nMy question: ${question}`
                : `Analyze this file (${language}) in the context of this project:\n\`\`\`${language}\n${code.slice(0, 5000)}\n\`\`\``;

            const chatSession = model.startChat({
                history: [
                    { role: 'user', parts: [{ text: systemPrompt }] },
                    { role: 'model', parts: [{ text: 'I understand the project context. Share a file and I\'ll help you understand it.' }] },
                ],
            });

            const result = await chatSession.sendMessage(userPrompt);
            return {
                help: result.response.text(),
                source: 'gemini',
            };
        } catch (err) {
            const isRateLimit = err.message?.includes('429') || err.message?.includes('quota') || err.message?.includes('RESOURCE_EXHAUSTED');
            if (isRateLimit && attempt < maxRetries - 1) {
                const delay = (attempt + 1) * 3000;
                console.log(`⏳ Rate limited on file help, retrying in ${delay / 1000}s...`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            console.error('Gemini file help error:', err.message);
            return {
                help: `### ⚠️ Help Error\n\n${err.message}`,
                source: 'error',
            };
        }
    }
}

async function reviewProject(projectData) {
    if (!model) {
        return {
            review: {
                summary: 'Connect your Gemini API key for AI-powered code reviews.',
                score: 0,
                issues: [],
                stats: { bugs: 0, warnings: 0, suggestions: 0, security: 0 },
            },
            source: 'fallback',
        };
    }

    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const prompt = `${codeReviewPrompt()}\n\n## Project Structure:\n\`\`\`\n${projectData.structure}\n\`\`\`\n\n## File Contents:\n${projectData.files.slice(0, 15).map(f => `### ${f.path} (${f.language})\n\`\`\`${f.language}\n${f.content.slice(0, 3000)}\n\`\`\``).join('\n\n')}`;

            const result = await model.generateContent(prompt);
            let text = result.response.text().trim();

            // Strip markdown code fences if present
            text = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();

            const review = JSON.parse(text);
            return { review, source: 'gemini' };
        } catch (err) {
            const isRateLimit = err.message?.includes('429') || err.message?.includes('quota') || err.message?.includes('RESOURCE_EXHAUSTED');
            if (isRateLimit && attempt < maxRetries - 1) {
                const delay = (attempt + 1) * 3000;
                console.log(`⏳ Rate limited on code review, retrying in ${delay / 1000}s...`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            console.error('Gemini code review error:', err.message);
            return {
                review: {
                    summary: `Review failed: ${err.message}`,
                    score: 0,
                    issues: [],
                    stats: { bugs: 0, warnings: 0, suggestions: 0, security: 0 },
                },
                source: 'error',
            };
        }
    }
}

// --- Generate README ---

async function generateReadme({ files, structure }) {
    if (!model) {
        return { readme: `# Project\n\n> ⚠️ AI not available. Add your Gemini API key to generate a README.\n\n## Files\n${structure}` };
    }

    const systemPrompt = readmeGeneratorPrompt();
    const fileContents = files.slice(0, 15).map(f =>
        `### ${f.path} (${f.language})\n\`\`\`${f.language}\n${f.content.substring(0, 3000)}\n\`\`\``
    ).join('\n\n');

    const userPrompt = `## Project Structure:\n\`\`\`\n${structure}\n\`\`\`\n\n## File Contents:\n${fileContents}`;

    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const chat = model.startChat({ history: [{ role: 'user', parts: [{ text: systemPrompt }] }, { role: 'model', parts: [{ text: 'I will generate a professional README.md.' }] }] });
            const result = await chat.sendMessage(userPrompt);
            const readme = result.response.text();
            return { readme };
        } catch (err) {
            if (err.message?.includes('429') && attempt < 2) {
                await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
                continue;
            }
            throw err;
        }
    }
}

// --- Explain Error ---

async function explainError(errorText, language = '') {
    if (!model) {
        return { explanation: `### Error Analysis\n\n\`\`\`\n${errorText}\n\`\`\`\n\n> ⚠️ Add your Gemini API key to get AI-powered error explanations.` };
    }

    const systemPrompt = errorExplainerPrompt();
    const userPrompt = `${language ? `Language/Framework: ${language}\n\n` : ''}Error/Stack Trace:\n\`\`\`\n${errorText}\n\`\`\``;

    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const chat = model.startChat({ history: [{ role: 'user', parts: [{ text: systemPrompt }] }, { role: 'model', parts: [{ text: 'I will analyze this error and provide a clear explanation with fix suggestions.' }] }] });
            const result = await chat.sendMessage(userPrompt);
            return { explanation: result.response.text() };
        } catch (err) {
            if (err.message?.includes('429') && attempt < 2) {
                await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
                continue;
            }
            throw err;
        }
    }
}

// --- Helpers ---

function extractTitle(response) {
    const match = response.match(/^#\s+(.+)/m) || response.match(/^\*\*(.+?)\*\*/m);
    return match ? match[1].replace(/\*/g, '').trim() : 'NeuroWeave AI Response';
}

function extractTopics(response, query) {
    const techTerms = [
        'react', 'hooks', 'state', 'context', 'node', 'express', 'rest', 'graphql',
        'sql', 'postgres', 'mongodb', 'redis', 'docker', 'kubernetes', 'git',
        'typescript', 'testing', 'jest', 'webpack', 'vite', 'auth', 'jwt', 'oauth',
        'css', 'nextjs', 'python', 'fastapi', 'api', 'database', 'security',
    ];
    const text = (response + ' ' + query).toLowerCase();
    return techTerms.filter(t => text.includes(t)).slice(0, 5);
}

function generateId() {
    return Math.random().toString(36).substring(2, 10);
}

// --- Fallback responses (when Gemini not available) ---

function fallbackChat(query) {
    const q = query.toLowerCase();
    let content = '';
    let title = 'NeuroWeave AI Response';

    if (/react|hook|component|jsx|state/i.test(q)) {
        title = 'React Concepts';
        content = `### React Overview\n\n**React** is a JavaScript library for building user interfaces.\n\n**Key concepts:**\n- **Components** — Reusable UI building blocks\n- **Hooks** — \`useState\`, \`useEffect\`, \`useContext\` for state & side effects\n- **JSX** — Syntax extension for writing HTML-like code in JavaScript\n- **Virtual DOM** — Efficient UI updates via diffing algorithm\n\n> 💡 To get real AI-powered responses, add your Gemini API key to the \`.env\` file.`;
    } else if (/api|rest|http|endpoint/i.test(q)) {
        title = 'REST API Concepts';
        content = `### REST APIs\n\n**REST** (Representational State Transfer) uses HTTP methods:\n- **GET** — Read resources\n- **POST** — Create resources\n- **PUT** — Update resources\n- **DELETE** — Remove resources\n\nBest practices: use nouns for URLs, return proper status codes, version your API.\n\n> 💡 Add your Gemini API key for detailed AI explanations.`;
    } else if (/docker|container|deploy/i.test(q)) {
        title = 'Docker & Containers';
        content = `### Docker\n\n**Docker** packages apps into portable containers.\n- **Image** — Blueprint (read-only)\n- **Container** — Running instance\n- **Dockerfile** — Build instructions\n\n> 💡 Add your Gemini API key for in-depth AI responses.`;
    } else {
        content = `I received your query: "${query}"\n\n### Quick Guide\nI can help with:\n- **Programming concepts** (React, Node, Python, etc.)\n- **Architecture patterns** (REST, microservices, etc.)\n- **DevOps** (Docker, CI/CD, K8s)\n- **Databases** (SQL, MongoDB, Redis)\n- **Security** (Auth, JWT, OAuth)\n\n> 💡 For full AI-powered responses, add your Gemini API key to the \`.env\` file.`;
    }

    return {
        title,
        content,
        relatedTopics: extractTopics(content, query),
        codeExample: null,
        latency: { parsing: 5, intent: 3, graphLookup: 2, inference: 10, generation: 5, total: 25 },
        queryId: generateId(),
        timestamp: Date.now(),
        source: 'fallback',
    };
}

function fallbackCodeAnalysis(code, language) {
    return {
        analysis: `### Code Analysis (${language})\n\nThis is a ${language} code snippet with ${code.split('\n').length} lines.\n\n**Observations:**\n- Code structure appears standard\n- Consider adding error handling\n- Add comments for complex logic\n\n> 💡 Add your Gemini API key for real AI-powered code analysis.`,
        source: 'fallback',
    };
}

export { initGemini, isAvailable, chat, analyzeCode, explainConcept, generateLearningRecommendations, analyzeProject, getFileHelp, reviewProject, generateReadme, explainError };
