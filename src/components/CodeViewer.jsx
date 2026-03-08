import React, { useState, useEffect, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
    Folder, FileText, ChevronRight, ChevronDown, Bot, AlertCircle, Lightbulb, Info,
    Wand2, Loader2, Code2, FileCode, ClipboardPaste, FolderOpen, Upload,
    MessageSquare, Send, X, FolderTree, GitPullRequest, Network, Shield, Bug
} from 'lucide-react';
import { fileTree, codeSnippets, aiAnnotations } from '../ai/codeData';
import { analyzeCode as apiAnalyzeCode, analyzeProjectAPI, getProjectFileHelp, reviewProjectAPI, generateReadmeAPI, explainErrorAPI } from '../api/client';

// --- Helpers ---

function flattenTree(tree, depth = 0) {
    const items = [];
    for (const node of tree) {
        items.push({ ...node, depth });
        if (node.type === 'folder' && node.children) {
            items.push(...flattenTree(node.children, depth + 1));
        }
    }
    return items;
}

const annotationIcons = { info: Info, tip: Lightbulb, warning: AlertCircle, pattern: Bot };

const languages = [
    'javascript', 'jsx', 'typescript', 'python', 'java', 'c', 'cpp',
    'csharp', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin',
    'html', 'css', 'sql', 'bash', 'json', 'yaml',
];

const EXT_LANG_MAP = {
    js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'typescript',
    py: 'python', java: 'java', c: 'c', cpp: 'cpp', h: 'c',
    cs: 'csharp', go: 'go', rs: 'rust', rb: 'ruby', php: 'php',
    swift: 'swift', kt: 'kotlin', html: 'html', css: 'css',
    sql: 'sql', sh: 'bash', json: 'json', yaml: 'yaml', yml: 'yaml',
    md: 'markdown', xml: 'xml', toml: 'toml', env: 'bash',
    txt: 'text', gitignore: 'bash', dockerfile: 'docker',
};

const BINARY_EXTS = new Set([
    'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp', 'bmp',
    'woff', 'woff2', 'ttf', 'eot', 'otf',
    'mp4', 'webm', 'mp3', 'wav', 'ogg',
    'zip', 'tar', 'gz', 'rar', '7z',
    'pdf', 'doc', 'docx', 'xls', 'xlsx',
    'exe', 'dll', 'so', 'dylib', 'o',
    'pyc', 'class', 'jar', 'lock',
    'db', 'sqlite', 'sqlite3', 'dat', 'bin', 'pem', 'key',
]);

const IGNORED_DIRS = new Set([
    'node_modules', '.git', '.next', 'dist', 'build', '__pycache__',
    '.cache', '.vscode', '.idea', 'coverage', '.DS_Store', 'vendor',
    'venv', '.venv', 'env', '.env', '.tox', '.eggs', 'site-packages',
    '.mypy_cache', '.pytest_cache', '.ruff_cache', 'htmlcov', 'egg-info',
]);

function getLang(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    return EXT_LANG_MAP[ext] || 'text';
}

function isBinary(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    return BINARY_EXTS.has(ext);
}

function shouldIgnore(path) {
    return path.split('/').some(part => IGNORED_DIRS.has(part));
}

function buildProjectTree(fileList) {
    const root = { name: 'root', type: 'folder', children: [] };
    for (const file of fileList) {
        const parts = file.path.split('/');
        let current = root;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (i === parts.length - 1) {
                current.children.push({
                    name: part, type: 'file', path: file.path,
                    language: file.language, size: file.size,
                });
            } else {
                let folder = current.children.find(c => c.name === part && c.type === 'folder');
                if (!folder) {
                    folder = { name: part, type: 'folder', children: [] };
                    current.children.push(folder);
                }
                current = folder;
            }
        }
    }
    // Sort: folders first, then alphabetically
    function sortTree(node) {
        if (node.children) {
            node.children.sort((a, b) => {
                if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
                return a.name.localeCompare(b.name);
            });
            node.children.forEach(sortTree);
        }
    }
    sortTree(root);
    return root.children;
}

function generateStructureText(tree, indent = '') {
    let text = '';
    for (const node of tree) {
        if (node.type === 'folder') {
            text += `${indent}📁 ${node.name}/\n`;
            if (node.children) text += generateStructureText(node.children, indent + '  ');
        } else {
            text += `${indent}📄 ${node.name}\n`;
        }
    }
    return text;
}

// --- Dependency Parser ---
function parseImports(files) {
    const graph = { nodes: [], links: [] };
    const fileSet = new Set(files.map(f => f.path));
    const nodeMap = new Map();
    const addedLinks = new Set(); // prevent duplicates

    const extColors = {
        jsx: '#a78bfa', tsx: '#a78bfa', js: '#10b981', ts: '#3b82f6',
        py: '#f59e0b', css: '#06b6d4', html: '#ef4444', json: '#8b5cf6',
        md: '#64748b', yaml: '#f97316', yml: '#f97316',
    };

    files.forEach((f, i) => {
        const ext = f.path.split('.').pop().toLowerCase();
        const name = f.path.split('/').pop();
        nodeMap.set(f.path, i);
        graph.nodes.push({
            id: i, path: f.path, name, ext,
            color: extColors[ext] || '#64748b',
            imports: 0, importedBy: 0,
        });
    });

    function tryLink(srcIdx, resolved) {
        const tryPaths = [resolved];
        // JS/TS extensions
        ['', '.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.jsx'].forEach(e => tryPaths.push(resolved + e));
        // Python extensions
        ['.py', '/__init__.py'].forEach(e => tryPaths.push(resolved + e));

        for (const tp of tryPaths) {
            if (nodeMap.has(tp)) {
                const targetIdx = nodeMap.get(tp);
                const linkKey = `${srcIdx}->${targetIdx}`;
                if (targetIdx !== srcIdx && !addedLinks.has(linkKey)) {
                    addedLinks.add(linkKey);
                    graph.links.push({ source: srcIdx, target: targetIdx });
                    graph.nodes[srcIdx].imports++;
                    graph.nodes[targetIdx].importedBy++;
                }
                return;
            }
        }
    }

    files.forEach((f, srcIdx) => {
        const content = f.content || '';
        const ext = f.path.split('.').pop().toLowerCase();
        const dir = f.path.includes('/') ? f.path.substring(0, f.path.lastIndexOf('/')) : '';

        if (['py'].includes(ext)) {
            // Python: from X import Y  or  import X
            const pyPatterns = [
                /^\s*from\s+([\w.]+)\s+import/gm,
                /^\s*import\s+([\w.]+)/gm,
            ];
            for (const pattern of pyPatterns) {
                pattern.lastIndex = 0;
                let match;
                while ((match = pattern.exec(content)) !== null) {
                    const mod = match[1];
                    // Convert dotted module to path: "app.models" -> "app/models"
                    const modPath = mod.replace(/\./g, '/');
                    // Try relative first
                    if (dir) tryLink(srcIdx, `${dir}/${modPath}`);
                    // Try from root
                    tryLink(srcIdx, modPath);
                    // Try just the first part (single file import)
                    const firstPart = mod.split('.')[0];
                    if (dir) tryLink(srcIdx, `${dir}/${firstPart}`);
                    tryLink(srcIdx, firstPart);
                }
            }
        } else {
            // JS/TS: import ... from '...', require('...')
            const jsPatterns = [
                /import\s+.*?from\s+['"](.+?)['"]/g,
                /require\s*\(\s*['"](.+?)['"]\s*\)/g,
                /import\s*['"](.+?)['"]/g,
            ];
            for (const pattern of jsPatterns) {
                pattern.lastIndex = 0;
                let match;
                while ((match = pattern.exec(content)) !== null) {
                    let imp = match[1];
                    if (!imp.startsWith('.')) continue;
                    let resolved = dir ? `${dir}/${imp}` : imp;
                    resolved = resolved.replace(/\/\.\//, '/').replace(/^\.\//,'');
                    tryLink(srcIdx, resolved);
                }
            }
        }
    });

    return graph;
}


// --- Dependency Sequence Diagram Component ---
function DependencyGraph({ graphData, onNodeClick }) {
    const [expandedNode, setExpandedNode] = useState(null);

    if (!graphData || !graphData.nodes.length) {
        return (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 13 }}>
                No dependency data found.
            </div>
        );
    }

    // Sort: most connections first
    const sorted = [...graphData.nodes].sort((a, b) => (b.imports + b.importedBy) - (a.imports + a.importedBy));

    // Build adjacency maps
    const importsMap = {};   // file -> [files it imports]
    const usedByMap = {};    // file -> [files that import it]
    graphData.links.forEach(link => {
        const src = graphData.nodes[link.source];
        const tgt = graphData.nodes[link.target];
        if (!src || !tgt) return;
        if (!importsMap[src.path]) importsMap[src.path] = [];
        importsMap[src.path].push(tgt);
        if (!usedByMap[tgt.path]) usedByMap[tgt.path] = [];
        usedByMap[tgt.path].push(src);
    });

    const extEmoji = { jsx: '⚛️', tsx: '⚛️', js: '📜', ts: '🔷', css: '🎨', html: '🌐', json: '📋', py: '🐍', md: '📝' };

    return (
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', background: '#0a0b14' }}>
            {/* Header stats */}
            <div style={{
                display: 'flex', gap: 12, marginBottom: 20, padding: '12px 16px', borderRadius: 10,
                background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(99,102,241,0.04))',
                border: '1px solid rgba(139,92,246,0.12)',
            }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#a78bfa' }}>{graphData.nodes.length}</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>Files</div>
                </div>
                <div style={{ width: 1, background: 'rgba(139,92,246,0.15)' }} />
                <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981' }}>{graphData.links.length}</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>Connections</div>
                </div>
                <div style={{ width: 1, background: 'rgba(139,92,246,0.15)' }} />
                <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b' }}>
                        {sorted.filter(n => n.importedBy === 0 && n.imports > 0).length}
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>Entry Points</div>
                </div>
                <div style={{ width: 1, background: 'rgba(139,92,246,0.15)' }} />
                <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#06b6d4' }}>
                        {sorted.filter(n => n.importedBy > 0 && n.imports === 0).length}
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>Leaf Modules</div>
                </div>
            </div>

            {/* Sequence diagram cards */}
            <div style={{ position: 'relative' }}>
                {/* Central line */}
                <div style={{
                    position: 'absolute', left: 24, top: 0, bottom: 0, width: 2,
                    background: 'linear-gradient(to bottom, #a78bfa33, #6366f133, #a78bfa33)',
                }} />

                {sorted.map((node, i) => {
                    const isExpanded = expandedNode === node.id;
                    const imports = importsMap[node.path] || [];
                    const usedBy = usedByMap[node.path] || [];
                    const hasConnections = imports.length > 0 || usedBy.length > 0;

                    return (
                        <div key={node.id} style={{ position: 'relative', marginBottom: 6, paddingLeft: 50 }}>
                            {/* Timeline dot */}
                            <div style={{
                                position: 'absolute', left: 17, top: 14, width: 16, height: 16,
                                borderRadius: '50%', background: node.color, border: '3px solid #0a0b14',
                                boxShadow: `0 0 8px ${node.color}40`,
                                zIndex: 2,
                            }} />

                            {/* Card */}
                            <div
                                onClick={() => { setExpandedNode(isExpanded ? null : node.id); }}
                                style={{
                                    padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                                    background: isExpanded ? 'rgba(139,92,246,0.06)' : 'rgba(15,23,42,0.6)',
                                    border: `1px solid ${isExpanded ? node.color + '40' : 'rgba(51,65,85,0.3)'}`,
                                    transition: 'all 0.2s',
                                }}
                            >
                                {/* File header */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 14 }}>{extEmoji[node.ext] || '📄'}</span>
                                    <span style={{ fontWeight: 600, fontSize: 13, color: '#e2e8f0', flex: 1 }}>{node.name}</span>
                                    <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'var(--font-mono)' }}>{node.path}</span>
                                    {imports.length > 0 && (
                                        <span style={{
                                            padding: '1px 7px', borderRadius: 10, fontSize: 9, fontWeight: 700,
                                            background: 'rgba(16,185,129,0.12)', color: '#10b981',
                                        }}>↑ {imports.length}</span>
                                    )}
                                    {usedBy.length > 0 && (
                                        <span style={{
                                            padding: '1px 7px', borderRadius: 10, fontSize: 9, fontWeight: 700,
                                            background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
                                        }}>↓ {usedBy.length}</span>
                                    )}
                                    {hasConnections && (
                                        <ChevronRight size={12} color="#64748b" style={{
                                            transform: isExpanded ? 'rotate(90deg)' : 'none',
                                            transition: 'transform 0.2s',
                                        }} />
                                    )}
                                </div>

                                {/* Expanded: show imports & usedBy */}
                                {isExpanded && hasConnections && (
                                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(100,116,139,0.15)' }}>
                                        {imports.length > 0 && (
                                            <div style={{ marginBottom: imports.length > 0 && usedBy.length > 0 ? 10 : 0 }}>
                                                <div style={{ fontSize: 10, fontWeight: 700, color: '#10b981', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                                                    ↗ Imports ({imports.length})
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                    {imports.map((dep, j) => (
                                                        <span key={j} onClick={(e) => { e.stopPropagation(); onNodeClick(dep); }}
                                                            style={{
                                                                padding: '3px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                                                                background: `${dep.color}12`, border: `1px solid ${dep.color}25`,
                                                                color: dep.color, fontWeight: 500, transition: 'all 0.15s',
                                                            }}
                                                            onMouseEnter={e => { e.currentTarget.style.background = dep.color + '25'; }}
                                                            onMouseLeave={e => { e.currentTarget.style.background = dep.color + '12'; }}
                                                        >
                                                            {extEmoji[dep.ext] || '📄'} {dep.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {usedBy.length > 0 && (
                                            <div>
                                                <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                                                    ↙ Used by ({usedBy.length})
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                    {usedBy.map((dep, j) => (
                                                        <span key={j} onClick={(e) => { e.stopPropagation(); onNodeClick(dep); }}
                                                            style={{
                                                                padding: '3px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                                                                background: `${dep.color}12`, border: `1px solid ${dep.color}25`,
                                                                color: dep.color, fontWeight: 500, transition: 'all 0.15s',
                                                            }}
                                                            onMouseEnter={e => { e.currentTarget.style.background = dep.color + '25'; }}
                                                            onMouseLeave={e => { e.currentTarget.style.background = dep.color + '12'; }}
                                                        >
                                                            {extEmoji[dep.ext] || '📄'} {dep.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div style={{
                display: 'flex', gap: 14, justifyContent: 'center', marginTop: 20,
                padding: '10px 0', borderTop: '1px solid rgba(100,116,139,0.12)', fontSize: 10, color: '#64748b',
            }}>
                <span>⚛️ JSX/TSX</span><span>📜 JS</span><span>🔷 TS</span><span>🎨 CSS</span>
                <span>🐍 Python</span><span>📄 Other</span>
                <span style={{ marginLeft: 8, color: '#10b981' }}>↑ = imports</span>
                <span style={{ color: '#f59e0b' }}>↓ = used by</span>
            </div>
        </div>
    );
}

// --- Review Panel Component ---
function ReviewPanel({ review, onIssueClick }) {
    if (!review) return null;
    const typeIcons = { bug: '🐛', warning: '⚠️', suggestion: '💡', security: '🔒' };
    const typeColors = { bug: '#ef4444', warning: '#f59e0b', suggestion: '#6366f1', security: '#f97316' };
    const sevColors = { critical: '#dc2626', high: '#ef4444', medium: '#f59e0b', low: '#64748b' };

    return (
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
            {/* Score header */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20,
                padding: '16px 20px', borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.05))',
                border: '1px solid rgba(99,102,241,0.15)',
            }}>
                <div style={{
                    width: 56, height: 56, borderRadius: '50%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22,
                    color: review.score >= 80 ? '#10b981' : review.score >= 50 ? '#f59e0b' : '#ef4444',
                    background: review.score >= 80 ? 'rgba(16,185,129,0.1)' : review.score >= 50 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `2px solid ${review.score >= 80 ? '#10b981' : review.score >= 50 ? '#f59e0b' : '#ef4444'}40`,
                }}>{review.score}</div>
                <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#e2e8f0', marginBottom: 4 }}>Code Quality Score</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{review.summary}</div>
                </div>
            </div>

            {/* Stats bar */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {Object.entries(review.stats || {}).map(([type, count]) => (
                    <div key={type} style={{
                        flex: 1, padding: '8px 10px', borderRadius: 8, textAlign: 'center',
                        background: `${typeColors[type]}10`, border: `1px solid ${typeColors[type]}20`,
                    }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: typeColors[type] }}>{count}</div>
                        <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'capitalize' }}>{typeIcons[type]} {type}s</div>
                    </div>
                ))}
            </div>

            {/* Issue cards */}
            {(review.issues || []).map((issue, i) => (
                <div key={i} onClick={() => onIssueClick?.(issue)}
                    style={{
                        padding: '12px 16px', marginBottom: 8, borderRadius: 10, cursor: 'pointer',
                        background: 'rgba(15,17,28,0.6)', border: `1px solid ${typeColors[issue.type]}20`,
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = typeColors[issue.type] + '60'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = typeColors[issue.type] + '20'}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{
                            padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                            background: `${typeColors[issue.type]}18`, color: typeColors[issue.type],
                            textTransform: 'uppercase',
                        }}>{typeIcons[issue.type]} {issue.type}</span>
                        <span style={{
                            padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600,
                            background: `${sevColors[issue.severity]}15`, color: sevColors[issue.severity],
                        }}>{issue.severity}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                            {issue.file}:{issue.line}
                        </span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#e2e8f0', marginBottom: 4 }}>{issue.title}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{issue.description}</div>
                    {issue.suggestion && (
                        <div style={{
                            marginTop: 8, padding: '6px 10px', borderRadius: 6,
                            background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)',
                            fontFamily: 'var(--font-mono)', fontSize: 11, color: '#10b981',
                        }}>💡 {issue.suggestion}</div>
                    )}
                </div>
            ))}
        </div>
    );
}

// --- Main Component ---

export default function CodeViewer() {
    const [mode, setMode] = useState('samples'); // 'samples' | 'custom' | 'project' | 'errorExplainer'
    const [selectedFile, setSelectedFile] = useState('Header.jsx');
    const [aiAnalysis, setAiAnalysis] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);

    // Custom code state
    const [customCode, setCustomCode] = useState('');
    const [customLang, setCustomLang] = useState('javascript');
    const [customAnalysis, setCustomAnalysis] = useState(null);

    // Project state
    const [projectFiles, setProjectFiles] = useState([]);
    const [projectTree, setProjectTree] = useState([]);
    const [projectOverview, setProjectOverview] = useState(null);
    const [projectLoading, setProjectLoading] = useState(false);
    const [selectedProjectFile, setSelectedProjectFile] = useState(null);
    const [projectFileHelp, setProjectFileHelp] = useState(null);
    const [helpLoading, setHelpLoading] = useState(false);
    const [helpQuestion, setHelpQuestion] = useState('');
    const [expandedFolders, setExpandedFolders] = useState(new Set());
    const [projectName, setProjectName] = useState('');
    const fileInputRef = useRef(null);

    // Codebase intelligence state
    const [projectSubTab, setProjectSubTab] = useState('overview'); // 'overview' | 'deps' | 'review' | 'readme'
    const [depGraph, setDepGraph] = useState(null);
    const [codeReview, setCodeReview] = useState(null);
    const [reviewLoading, setReviewLoading] = useState(false);

    // README generator state
    const [generatedReadme, setGeneratedReadme] = useState(null);
    const [readmeLoading, setReadmeLoading] = useState(false);

    // Error explainer state
    const [errorInput, setErrorInput] = useState('');
    const [errorLang, setErrorLang] = useState('');
    const [errorResult, setErrorResult] = useState(null);
    const [errorLoading, setErrorLoading] = useState(false);

    const flatItems = flattenTree(fileTree);
    const snippet = codeSnippets[selectedFile];
    const annotations = aiAnnotations[selectedFile] || [];

    // --- Sample file handlers ---
    const handleAnalyzeSample = async () => {
        if (!snippet) return;
        setAnalyzing(true); setAiAnalysis(null);
        try {
            const result = await apiAnalyzeCode(snippet.code, snippet.language);
            setAiAnalysis(result.analysis);
        } catch (err) {
            setAiAnalysis(`⚠️ Could not analyze: ${err.message}`);
        } finally { setAnalyzing(false); }
    };

    // --- Custom code handlers ---
    const handleAnalyzeCustom = async () => {
        if (!customCode.trim()) return;
        setAnalyzing(true); setCustomAnalysis(null);
        try {
            const result = await apiAnalyzeCode(customCode, customLang);
            setCustomAnalysis(result.analysis);
        } catch (err) {
            setCustomAnalysis(`⚠️ Could not analyze: ${err.message}`);
        } finally { setAnalyzing(false); }
    };

    // --- Project handlers ---
    const handleFolderSelect = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        setProjectLoading(true);
        setProjectOverview(null);
        setSelectedProjectFile(null);
        setProjectFileHelp(null);

        // Extract project name from first file's path
        const firstPath = files[0].webkitRelativePath || '';
        const rootFolder = firstPath.split('/')[0] || 'Project';
        setProjectName(rootFolder);

        const processedFiles = [];
        for (const file of files) {
            const relPath = file.webkitRelativePath?.replace(`${rootFolder}/`, '') || file.name;
            if (shouldIgnore(relPath) || isBinary(file.name)) continue;
            if (file.size > 100000) continue; // Skip files > 100KB

            try {
                const content = await file.text();
                processedFiles.push({
                    path: relPath,
                    content,
                    language: getLang(file.name),
                    size: file.size,
                });
            } catch { /* skip unreadable files */ }
        }

        setProjectFiles(processedFiles);
        const tree = buildProjectTree(processedFiles);
        setProjectTree(tree);

        // Build dependency graph
        setDepGraph(parseImports(processedFiles));
        setCodeReview(null);
        setProjectSubTab('overview');

        // Auto-expand first level
        const firstLevelFolders = tree.filter(n => n.type === 'folder').map(n => n.name);
        setExpandedFolders(new Set(firstLevelFolders));

        // Analyze project with AI
        const structure = generateStructureText(tree);
        try {
            const result = await analyzeProjectAPI(processedFiles.slice(0, 15), structure);
            setProjectOverview(result.overview);
        } catch (err) {
            setProjectOverview(`⚠️ Could not analyze project: ${err.message}`);
        } finally {
            setProjectLoading(false);
        }
    };

    const handleProjectFileClick = (file) => {
        const pf = projectFiles.find(f => f.path === file.path);
        if (pf) {
            setSelectedProjectFile(pf);
            setProjectFileHelp(null);
            setHelpQuestion('');
        }
    };

    const handleAskHelp = async (question = '') => {
        if (!selectedProjectFile) return;
        setHelpLoading(true); setProjectFileHelp(null);
        try {
            const context = projectOverview || generateStructureText(projectTree);
            const result = await getProjectFileHelp(
                selectedProjectFile.content,
                selectedProjectFile.language,
                context,
                question
            );
            setProjectFileHelp(result.help);
        } catch (err) {
            setProjectFileHelp(`⚠️ ${err.message}`);
        } finally { setHelpLoading(false); }
    };

    const toggleFolder = (path) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            next.has(path) ? next.delete(path) : next.add(path);
            return next;
        });
    };

    const clearProject = () => {
        setProjectFiles([]); setProjectTree([]); setProjectOverview(null);
        setSelectedProjectFile(null); setProjectFileHelp(null);
        setProjectName(''); setDepGraph(null); setCodeReview(null);
        setProjectSubTab('overview'); setReviewLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRunReview = async () => {
        if (!projectFiles.length) return;
        setReviewLoading(true); setCodeReview(null);
        try {
            const structure = generateStructureText(projectTree);
            const result = await reviewProjectAPI(projectFiles.slice(0, 15), structure);
            setCodeReview(result.review);
        } catch (err) {
            setCodeReview({ summary: `Review failed: ${err.message}`, score: 0, issues: [], stats: { bugs: 0, warnings: 0, suggestions: 0, security: 0 } });
        } finally { setReviewLoading(false); }
    };

    const handleIssueClick = (issue) => {
        const pf = projectFiles.find(f => f.path === issue.file);
        if (pf) { setSelectedProjectFile(pf); setProjectSubTab('overview'); }
    };

    const handleDepNodeClick = (node) => {
        const pf = projectFiles.find(f => f.path === node.path);
        if (pf) { setSelectedProjectFile(pf); setProjectSubTab('overview'); }
    };

    const handleGenerateReadme = async () => {
        if (!projectFiles.length) return;
        setReadmeLoading(true); setGeneratedReadme(null);
        try {
            const structure = generateStructureText(projectTree);
            const result = await generateReadmeAPI(projectFiles.slice(0, 15), structure);
            setGeneratedReadme(result.readme);
        } catch (err) {
            setGeneratedReadme(`# Error\n\nFailed to generate README: ${err.message}\n\nPlease try again.`);
        } finally { setReadmeLoading(false); }
    };

    const handleExplainError = async () => {
        if (!errorInput.trim()) return;
        setErrorLoading(true); setErrorResult(null);
        try {
            const result = await explainErrorAPI(errorInput, errorLang);
            setErrorResult(result.explanation);
        } catch (err) {
            setErrorResult(`### ❌ Failed to analyze error\n\n${err.message}\n\nPlease check your connection and try again.`);
        } finally { setErrorLoading(false); }
    };

    // --- Render project tree recursively ---
    const renderProjectTree = (nodes, depth = 0, parentPath = '') => {
        return nodes.map((node, idx) => {
            const fullPath = parentPath ? `${parentPath}/${node.name}` : node.name;
            const isExpanded = expandedFolders.has(fullPath);

            if (node.type === 'folder') {
                return (
                    <React.Fragment key={fullPath}>
                        <div
                            className="code-tree__item code-tree__item--folder"
                            style={{ paddingLeft: 12 + depth * 14 }}
                            onClick={() => toggleFolder(fullPath)}
                        >
                            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            <Folder size={13} color="#f59e0b" />
                            <span>{node.name}</span>
                        </div>
                        {isExpanded && node.children && renderProjectTree(node.children, depth + 1, fullPath)}
                    </React.Fragment>
                );
            }
            return (
                <div
                    key={fullPath}
                    className={`code-tree__item ${selectedProjectFile?.path === node.path ? 'code-tree__item--active' : ''}`}
                    style={{ paddingLeft: 12 + depth * 14 }}
                    onClick={() => handleProjectFileClick(node)}
                >
                    <FileText size={13} color="var(--accent-secondary)" />
                    <span>{node.name}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)', opacity: 0.6 }}>
                        {node.size > 1024 ? `${(node.size / 1024).toFixed(0)}K` : `${node.size}B`}
                    </span>
                </div>
            );
        });
    };

    return (
        <div className="code-viewer">
            {/* Left sidebar */}
            <div className="code-viewer__tree">
                {/* Mode toggle */}
                <div style={{
                    display: 'flex', gap: 2, padding: '8px 6px 4px',
                    borderBottom: '1px solid var(--border-color)', marginBottom: 6,
                }}>
                    {[
                        { id: 'samples', icon: FileCode, label: 'Samples', color: 'var(--accent-secondary)' },
                        { id: 'custom', icon: Code2, label: 'Code', color: 'var(--success)' },
                        { id: 'project', icon: FolderTree, label: 'Project', color: '#f59e0b' },
                        { id: 'errorExplainer', icon: Bug, label: 'Debug', color: '#ef4444' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setMode(tab.id)}
                            style={{
                                flex: 1, padding: '5px 4px', border: 'none', borderRadius: 6,
                                background: mode === tab.id ? `${tab.color}15` : 'transparent',
                                color: mode === tab.id ? tab.color : 'var(--text-muted)',
                                fontSize: 10, fontWeight: 600, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'center',
                                transition: 'all 0.2s',
                            }}
                        >
                            <tab.icon size={11} /> {tab.label}
                        </button>
                    ))}
                </div>

                {/* Sidebar content per mode */}
                {mode === 'samples' && (
                    flatItems.map((item, idx) => (
                        <div key={idx}
                            className={`code-tree__item ${item.type === 'folder' ? 'code-tree__item--folder' : ''} ${item.name === selectedFile ? 'code-tree__item--active' : ''}`}
                            style={{ paddingLeft: 16 + item.depth * 16 }}
                            onClick={() => { if (item.type === 'file' && codeSnippets[item.name]) setSelectedFile(item.name); }}
                        >
                            {item.type === 'folder' ? (
                                <><ChevronRight size={12} style={{ opacity: 0.5 }} /><Folder size={14} color="#f59e0b" /></>
                            ) : (
                                <FileText size={14} color="var(--accent-secondary)" />
                            )}
                            <span>{item.name}</span>
                        </div>
                    ))
                )}

                {mode === 'custom' && (
                    <div style={{ padding: '8px 12px' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Language</div>
                        <select value={customLang} onChange={e => setCustomLang(e.target.value)}
                            style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }}
                        >
                            {languages.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 14, lineHeight: 1.7 }}>
                            <p>📋 Paste any code snippet</p>
                            <p>🔍 Get AI-powered analysis</p>
                            <p>🏗️ Architecture patterns</p>
                            <p>⚠️ Security issues</p>
                            <p>💡 Improvements</p>
                        </div>
                    </div>
                )}

                {mode === 'project' && (
                    <div style={{ padding: '6px 10px', overflow: 'auto', flex: 1 }}>
                        {projectTree.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '20px 10px' }}>
                                <FolderOpen size={28} color="#f59e0b" style={{ opacity: 0.5, marginBottom: 10 }} />
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                                    Upload a project folder to analyze its structure
                                </div>
                                <input type="file" ref={fileInputRef}
                                    webkitdirectory="" directory="" multiple
                                    onChange={handleFolderSelect}
                                    style={{ display: 'none' }}
                                />
                                <button onClick={() => fileInputRef.current?.click()}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6, margin: '0 auto',
                                        padding: '8px 16px', border: '1px dashed #f59e0b55',
                                        borderRadius: 8, background: 'rgba(245,158,11,0.08)',
                                        color: '#f59e0b', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                    }}
                                >
                                    <Upload size={14} /> Select Folder
                                </button>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.6 }}>
                                    <p>• Reads files in-browser</p>
                                    <p>• Skips node_modules, .git</p>
                                    <p>• Max 100KB per file</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    marginBottom: 8, padding: '4px 0',
                                }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <FolderOpen size={13} /> {projectName}
                                    </div>
                                    <button onClick={clearProject} title="Remove project"
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
                                    >
                                        <X size={13} />
                                    </button>
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>
                                    {projectFiles.length} files loaded
                                </div>
                                {renderProjectTree(projectTree)}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Main content */}
            <div className="code-viewer__content">

                {/* ===== SAMPLES MODE ===== */}
                {mode === 'samples' && (
                    snippet ? (
                        <>
                            <div className="code-viewer__header">
                                <span className="code-viewer__filename">{selectedFile}</span>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <button onClick={handleAnalyzeSample} disabled={analyzing}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
                                            border: '1px solid var(--border-color)', borderRadius: 8,
                                            background: analyzing ? 'var(--bg-tertiary)' : 'rgba(99,102,241,0.1)',
                                            color: 'var(--accent-secondary)', cursor: analyzing ? 'wait' : 'pointer',
                                            fontSize: 12, fontWeight: 600, transition: 'all 0.2s',
                                        }}
                                    >
                                        {analyzing ? <Loader2 size={13} className="spin" /> : <Wand2 size={13} />}
                                        {analyzing ? 'Analyzing...' : 'Analyze with AI'}
                                    </button>
                                    <span className="code-viewer__lang-badge">{snippet.language}</span>
                                </div>
                            </div>
                            <div className="code-viewer__source">
                                <SyntaxHighlighter language={snippet.language === 'jsx' ? 'jsx' : 'javascript'}
                                    style={oneDark} showLineNumbers wrapLines
                                    customStyle={{ margin: 0, padding: 16, background: '#0a0b14', fontSize: 13, lineHeight: '1.7', minHeight: '100%' }}
                                    lineNumberStyle={{ color: '#334155', fontSize: 12, paddingRight: 16, minWidth: 40 }}
                                >{snippet.code}</SyntaxHighlighter>
                            </div>
                            {aiAnalysis && (
                                <div className="code-annotations" style={{ borderTop: '1px solid var(--accent-primary)' }}>
                                    <div className="code-annotations__title"><Wand2 size={14} color="var(--accent-primary)" /> Gemini AI Analysis</div>
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{aiAnalysis}</div>
                                </div>
                            )}
                            {annotations.length > 0 && !aiAnalysis && (
                                <div className="code-annotations">
                                    <div className="code-annotations__title"><Bot size={14} color="var(--accent-primary)" /> AI Insights</div>
                                    {annotations.map((ann, i) => (
                                        <div key={i} className="code-annotation">
                                            <span className={`code-annotation__badge code-annotation__badge--${ann.type}`}>{ann.type}</span>
                                            <span className="code-annotation__line">L{ann.line}</span>
                                            <span className="code-annotation__text">{ann.text}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', fontSize: 14 }}>
                            Select a file to view its code
                        </div>
                    )
                )}

                {/* ===== CUSTOM CODE MODE ===== */}
                {mode === 'custom' && (
                    <>
                        <div className="code-viewer__header">
                            <span className="code-viewer__filename" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <ClipboardPaste size={14} /> Paste Your Code
                            </span>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <button onClick={handleAnalyzeCustom} disabled={analyzing || !customCode.trim()}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
                                        border: '1px solid var(--border-color)', borderRadius: 8,
                                        background: !customCode.trim() ? 'var(--bg-tertiary)' : 'rgba(16,185,129,0.15)',
                                        color: !customCode.trim() ? 'var(--text-muted)' : 'var(--success)',
                                        cursor: analyzing || !customCode.trim() ? 'default' : 'pointer',
                                        fontSize: 12, fontWeight: 600, transition: 'all 0.2s',
                                    }}
                                >
                                    {analyzing ? <Loader2 size={13} className="spin" /> : <Wand2 size={13} />}
                                    {analyzing ? 'Analyzing...' : 'Analyze with AI'}
                                </button>
                                <span className="code-viewer__lang-badge">{customLang}</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', flexDirection: 'column' }}>
                            {customCode.trim() ? (
                                <div className="code-viewer__source" style={{ position: 'relative' }}>
                                    <SyntaxHighlighter language={customLang} style={oneDark} showLineNumbers wrapLines
                                        customStyle={{ margin: 0, padding: 16, background: '#0a0b14', fontSize: 13, lineHeight: '1.7', minHeight: 200 }}
                                        lineNumberStyle={{ color: '#334155', fontSize: 12, paddingRight: 16, minWidth: 40 }}
                                    >{customCode}</SyntaxHighlighter>
                                    <button onClick={() => { setCustomCode(''); setCustomAnalysis(null); }}
                                        style={{ position: 'absolute', top: 8, right: 12, padding: '3px 10px', border: '1px solid var(--border-color)', borderRadius: 6, background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                                    >Clear</button>
                                </div>
                            ) : (
                                <textarea value={customCode} onChange={e => { setCustomCode(e.target.value); setCustomAnalysis(null); }}
                                    placeholder={`// Paste your ${customLang} code here...\n// Then click "Analyze with AI"\n\nfunction example() {\n  console.log("Hello!");\n}`}
                                    style={{ width: '100%', height: '100%', minHeight: 300, padding: 16, border: 'none', outline: 'none', background: '#0a0b14', color: '#e2e8f0', fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: '1.7', resize: 'none' }}
                                />
                            )}
                        </div>
                        {customAnalysis && (
                            <div className="code-annotations" style={{ borderTop: '1px solid var(--success)', maxHeight: '40%', overflow: 'auto' }}>
                                <div className="code-annotations__title"><Wand2 size={14} color="var(--success)" /> Gemini AI Analysis — {customLang}</div>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{customAnalysis}</div>
                            </div>
                        )}
                    </>
                )}

                {/* ===== PROJECT MODE ===== */}
                {mode === 'project' && (
                    projectTree.length === 0 ? (
                        /* Upload prompt */
                        <div className="project-upload-zone">
                            <input type="file" ref={fileInputRef} webkitdirectory="" directory="" multiple onChange={handleFolderSelect} style={{ display: 'none' }} />
                            <div className="project-upload-zone__inner" onClick={() => fileInputRef.current?.click()}>
                                <div className="project-upload-zone__icon">
                                    <FolderOpen size={48} />
                                </div>
                                <h3>Upload Your Project</h3>
                                <p>Select a project folder to analyze its structure, code quality, and get AI-powered insights</p>
                                <button className="project-upload-zone__btn">
                                    <Upload size={16} /> Select Folder
                                </button>
                                <div className="project-upload-zone__hints">
                                    <span>📂 Reads all files in-browser</span>
                                    <span>🚫 Auto-skips node_modules, .git, binaries</span>
                                    <span>🔒 No files are stored — analysis only</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Project view with sub-tabs */
                        <>
                            <div className="code-viewer__header">
                                <span className="code-viewer__filename" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <FolderOpen size={14} color="#f59e0b" />
                                    {selectedProjectFile ? selectedProjectFile.path : `${projectName}`}
                                </span>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    {selectedProjectFile && (
                                        <>
                                            <button onClick={() => handleAskHelp()} disabled={helpLoading}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
                                                    border: '1px solid var(--border-color)', borderRadius: 8,
                                                    background: helpLoading ? 'var(--bg-tertiary)' : 'rgba(245,158,11,0.12)',
                                                    color: '#f59e0b', cursor: helpLoading ? 'wait' : 'pointer',
                                                    fontSize: 12, fontWeight: 600, transition: 'all 0.2s',
                                                }}
                                            >
                                                {helpLoading ? <Loader2 size={13} className="spin" /> : <Wand2 size={13} />}
                                                {helpLoading ? 'Analyzing...' : 'Analyze File'}
                                            </button>
                                            <button onClick={() => setSelectedProjectFile(null)}
                                                style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 8, padding: '5px 10px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}
                                            >
                                                ← Back
                                            </button>
                                        </>
                                    )}
                                    <span className="code-viewer__lang-badge">
                                        {selectedProjectFile ? selectedProjectFile.language : `${projectFiles.length} files`}
                                    </span>
                                </div>
                            </div>

                            {/* Sub-tab navigation */}
                            {!selectedProjectFile && (
                                <div style={{
                                    display: 'flex', gap: 2, padding: '4px 8px',
                                    borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
                                }}>
                                    {[
                                        { id: 'overview', label: 'Overview', icon: '📊' },
                                        { id: 'deps', label: 'Dependencies', icon: '🕸️' },
                                        { id: 'review', label: 'Code Review', icon: '🔍' },
                                        { id: 'readme', label: 'README', icon: '📝' },
                                    ].map(tab => (
                                        <button key={tab.id} onClick={() => {
                                            setProjectSubTab(tab.id);
                                            if (tab.id === 'review' && !codeReview && !reviewLoading) handleRunReview();
                                            if (tab.id === 'readme' && !generatedReadme && !readmeLoading) handleGenerateReadme();
                                        }}
                                            style={{
                                                padding: '6px 14px', border: 'none', borderRadius: 6,
                                                background: projectSubTab === tab.id ? 'rgba(139,92,246,0.12)' : 'transparent',
                                                color: projectSubTab === tab.id ? '#a78bfa' : 'var(--text-muted)',
                                                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.2s',
                                                borderBottom: projectSubTab === tab.id ? '2px solid #a78bfa' : '2px solid transparent',
                                            }}
                                        >
                                            {tab.icon} {tab.label}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {selectedProjectFile ? (
                                /* File view within project */
                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                                    <div className="code-viewer__source">
                                        <SyntaxHighlighter
                                            language={selectedProjectFile.language}
                                            style={oneDark} showLineNumbers wrapLines
                                            customStyle={{ margin: 0, padding: 16, background: '#0a0b14', fontSize: 13, lineHeight: '1.7', minHeight: 200 }}
                                            lineNumberStyle={{ color: '#334155', fontSize: 12, paddingRight: 16, minWidth: 40 }}
                                        >
                                            {selectedProjectFile.content}
                                        </SyntaxHighlighter>
                                    </div>
                                    <div style={{
                                        display: 'flex', gap: 8, padding: '10px 14px',
                                        borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
                                    }}>
                                        <input value={helpQuestion} onChange={e => setHelpQuestion(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter' && helpQuestion.trim()) handleAskHelp(helpQuestion); }}
                                            placeholder="Ask AI about this file..."
                                            style={{
                                                flex: 1, padding: '8px 12px', borderRadius: 8,
                                                border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)',
                                                color: 'var(--text-primary)', fontSize: 12, outline: 'none',
                                            }}
                                        />
                                        <button onClick={() => helpQuestion.trim() && handleAskHelp(helpQuestion)}
                                            disabled={helpLoading || !helpQuestion.trim()}
                                            style={{
                                                padding: '8px 14px', border: 'none', borderRadius: 8,
                                                background: helpQuestion.trim() ? 'rgba(245,158,11,0.15)' : 'var(--bg-tertiary)',
                                                color: helpQuestion.trim() ? '#f59e0b' : 'var(--text-muted)',
                                                cursor: helpQuestion.trim() ? 'pointer' : 'default',
                                                display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600,
                                            }}
                                        >
                                            {helpLoading ? <Loader2 size={13} className="spin" /> : <Send size={13} />} Ask
                                        </button>
                                    </div>
                                    {projectFileHelp && (
                                        <div className="code-annotations" style={{ borderTop: '1px solid #f59e0b', maxHeight: '40%', overflow: 'auto' }}>
                                            <div className="code-annotations__title">
                                                <MessageSquare size={14} color="#f59e0b" /> AI Help — {selectedProjectFile.path}
                                            </div>
                                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                                {projectFileHelp}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : projectSubTab === 'overview' ? (
                                /* Overview */
                                <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
                                    {projectLoading ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
                                            <Loader2 size={32} className="spin" color="#f59e0b" />
                                            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Analyzing project architecture...</div>
                                        </div>
                                    ) : projectOverview ? (
                                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                                            {projectOverview}
                                        </div>
                                    ) : (
                                        <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 40 }}>
                                            Click a file in the sidebar to view its code, or wait for project analysis.
                                        </div>
                                    )}
                                </div>
                            ) : projectSubTab === 'deps' ? (
                                /* Dependency Graph */
                                depGraph && depGraph.nodes.length > 0 ? (
                                    <DependencyGraph graphData={depGraph} onNodeClick={handleDepNodeClick} />
                                ) : (
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                                        No dependencies found. Try uploading a project with import/require statements.
                                    </div>
                                )
                            ) : projectSubTab === 'review' ? (
                                /* Code Review */
                                reviewLoading ? (
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                                        <Loader2 size={32} className="spin" color="#a78bfa" />
                                        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Running AI code review...</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.6 }}>
                                            Analyzing {projectFiles.length} files for bugs, security issues & improvements
                                        </div>
                                    </div>
                                ) : codeReview ? (
                                    <ReviewPanel review={codeReview} onIssueClick={handleIssueClick} />
                                ) : (
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <button onClick={handleRunReview} style={{
                                            display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px',
                                            border: '1px solid rgba(139,92,246,0.3)', borderRadius: 10,
                                            background: 'rgba(139,92,246,0.08)', color: '#a78bfa',
                                            fontSize: 14, fontWeight: 600, cursor: 'pointer',
                                        }}>
                                            <GitPullRequest size={18} /> Run Code Review
                                        </button>
                                    </div>
                                )
                            ) : projectSubTab === 'readme' ? (
                                /* README Generator */
                                readmeLoading ? (
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                                        <Loader2 size={32} className="spin" color="#10b981" />
                                        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Generating README.md...</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.6 }}>
                                            Analyzing project structure and creating documentation
                                        </div>
                                    </div>
                                ) : generatedReadme ? (
                                    <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                📝 Generated README.md
                                            </div>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button onClick={() => {
                                                    navigator.clipboard.writeText(generatedReadme);
                                                }}
                                                    style={{
                                                        padding: '5px 12px', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 6,
                                                        background: 'rgba(16,185,129,0.08)', color: '#10b981',
                                                        fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                                    }}
                                                >
                                                    📋 Copy
                                                </button>
                                                <button onClick={handleGenerateReadme}
                                                    style={{
                                                        padding: '5px 12px', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 6,
                                                        background: 'rgba(139,92,246,0.08)', color: '#a78bfa',
                                                        fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                                    }}
                                                >
                                                    🔄 Regenerate
                                                </button>
                                            </div>
                                        </div>
                                        <div style={{
                                            background: 'rgba(15,23,42,0.8)', borderRadius: 10, padding: 16,
                                            border: '1px solid rgba(16,185,129,0.12)', overflow: 'auto',
                                        }}>
                                            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#e2e8f0', lineHeight: 1.7, margin: 0, fontFamily: 'var(--font-mono)' }}>
                                                {generatedReadme}
                                            </pre>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <button onClick={handleGenerateReadme} style={{
                                            display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px',
                                            border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10,
                                            background: 'rgba(16,185,129,0.08)', color: '#10b981',
                                            fontSize: 14, fontWeight: 600, cursor: 'pointer',
                                        }}>
                                            📝 Generate README.md
                                        </button>
                                    </div>
                                )
                            ) : null}
                        </>
                    )
                )}
            </div>

                {/* Error Explainer Mode */}
                {mode === 'errorExplainer' && (
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                        {/* Header */}
                        <div style={{
                            padding: '12px 16px', borderBottom: '1px solid var(--border-color)',
                            display: 'flex', alignItems: 'center', gap: 10,
                            background: 'linear-gradient(135deg, rgba(239,68,68,0.06), transparent)',
                        }}>
                            <Bug size={18} color="#ef4444" />
                            <span style={{ fontWeight: 700, fontSize: 14, color: '#ef4444' }}>Error Explainer</span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Paste any error or stack trace for AI-powered debugging</span>
                        </div>

                        {/* Input area */}
                        <div style={{ padding: 16, borderBottom: '1px solid var(--border-color)' }}>
                            <textarea
                                value={errorInput}
                                onChange={e => setErrorInput(e.target.value)}
                                placeholder={'Paste your error message or stack trace here...\n\nExamples:\n• TypeError: Cannot read properties of undefined\n• EADDRINUSE: address already in use :::3000\n• ModuleNotFoundError: No module named \'flask\''}
                                style={{
                                    width: '100%', minHeight: 120, resize: 'vertical', padding: 14,
                                    background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(239,68,68,0.15)',
                                    borderRadius: 10, color: '#e2e8f0', fontSize: 12, fontFamily: 'var(--font-mono)',
                                    lineHeight: 1.6, outline: 'none',
                                }}
                                onFocus={e => e.target.style.borderColor = 'rgba(239,68,68,0.4)'}
                                onBlur={e => e.target.style.borderColor = 'rgba(239,68,68,0.15)'}
                            />
                            <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center' }}>
                                <select
                                    value={errorLang}
                                    onChange={e => setErrorLang(e.target.value)}
                                    style={{
                                        padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(100,116,139,0.2)',
                                        background: 'rgba(15,23,42,0.6)', color: '#e2e8f0', fontSize: 11,
                                        outline: 'none', cursor: 'pointer',
                                    }}
                                >
                                    <option value="">Auto-detect</option>
                                    <option value="javascript">JavaScript / Node.js</option>
                                    <option value="python">Python</option>
                                    <option value="typescript">TypeScript</option>
                                    <option value="react">React</option>
                                    <option value="java">Java</option>
                                    <option value="c++">C / C++</option>
                                    <option value="rust">Rust</option>
                                    <option value="go">Go</option>
                                    <option value="docker">Docker</option>
                                    <option value="git">Git</option>
                                </select>
                                <button
                                    onClick={handleExplainError}
                                    disabled={!errorInput.trim() || errorLoading}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 18px',
                                        border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
                                        background: errorInput.trim() ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.04)',
                                        color: errorInput.trim() ? '#ef4444' : '#64748b',
                                        fontSize: 12, fontWeight: 600, cursor: errorInput.trim() ? 'pointer' : 'not-allowed',
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    {errorLoading ? <Loader2 size={14} className="spin" /> : <Wand2 size={14} />}
                                    {errorLoading ? 'Analyzing...' : 'Explain Error'}
                                </button>
                                {errorResult && (
                                    <button
                                        onClick={() => { setErrorResult(null); setErrorInput(''); }}
                                        style={{
                                            padding: '7px 12px', border: '1px solid rgba(100,116,139,0.2)', borderRadius: 8,
                                            background: 'transparent', color: 'var(--text-muted)',
                                            fontSize: 11, cursor: 'pointer',
                                        }}
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Result */}
                        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                            {errorLoading ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
                                    <Loader2 size={32} className="spin" color="#ef4444" />
                                    <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Analyzing error...</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.6 }}>
                                        Finding root cause and generating fix suggestions
                                    </div>
                                </div>
                            ) : errorResult ? (
                                <div style={{
                                    background: 'rgba(15,23,42,0.6)', borderRadius: 10, padding: 20,
                                    border: '1px solid rgba(239,68,68,0.1)',
                                    fontSize: 13, color: '#e2e8f0', lineHeight: 1.8, whiteSpace: 'pre-wrap',
                                }}>
                                    {errorResult}
                                </div>
                            ) : (
                                <div style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    height: '100%', gap: 16, color: 'var(--text-muted)',
                                }}>
                                    <Bug size={48} color="rgba(239,68,68,0.2)" />
                                    <div style={{ fontSize: 14, fontWeight: 600 }}>Paste an error to get started</div>
                                    <div style={{ fontSize: 11, maxWidth: 300, textAlign: 'center', lineHeight: 1.6, opacity: 0.7 }}>
                                        Works with any language — JavaScript, Python, TypeScript, Java, Docker, Git, and more.
                                        Get instant explanations with fix suggestions.
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

            <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
