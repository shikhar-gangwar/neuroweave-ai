import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { initGemini } from './ai/gemini.js';
import { initDB } from './db/database.js';
import chatRoutes from './routes/chat.js';
import knowledgeRoutes from './routes/knowledge.js';
import progressRoutes from './routes/progress.js';
import codeRoutes from './routes/code.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 60,
    message: { error: 'Too many requests. Please try again later.' },
});
app.use('/api/', limiter);

// Request logging
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    }
    next();
});

// Routes
app.use('/api/chat', chatRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/code', codeRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: Math.floor(process.uptime()),
        gemini: initGemini() ? 'connected' : 'fallback',
        timestamp: new Date().toISOString(),
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Initialize and start
function start() {
    console.log('\n🧠 NeuroWeave AI Server');
    console.log('─'.repeat(40));

    // Init database
    initDB();

    // Init Gemini
    const geminiReady = initGemini();
    if (!geminiReady) {
        console.log('⚠️  Running without Gemini AI (using fallback responses)');
        console.log('   Set GEMINI_API_KEY in .env for real AI features\n');
    }

    app.listen(PORT, () => {
        console.log(`🚀 Server running at http://localhost:${PORT}`);
        console.log(`📡 API endpoints:`);
        console.log(`   POST /api/chat          — AI chat`);
        console.log(`   GET  /api/knowledge/graph — Knowledge graph`);
        console.log(`   GET  /api/progress/:id   — User progress`);
        console.log(`   POST /api/code/analyze   — Code analysis`);
        console.log(`   GET  /api/health         — Health check`);
        console.log('─'.repeat(40) + '\n');
    });
}

start();
