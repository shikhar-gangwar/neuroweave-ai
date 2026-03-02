import React, { useState, useEffect, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
    Folder, FileText, ChevronRight, ChevronDown, Bot, AlertCircle, Lightbulb, Info,
    Wand2, Loader2, Code2, FileCode, ClipboardPaste, FolderOpen, Upload,
    MessageSquare, Send, X, FolderTree
} from 'lucide-react';
import { fileTree, codeSnippets, aiAnnotations } from '../ai/codeData';
import { analyzeCode as apiAnalyzeCode, analyzeProjectAPI, getProjectFileHelp } from '../api/client';

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
]);

const IGNORED_DIRS = new Set([
    'node_modules', '.git', '.next', 'dist', 'build', '__pycache__',
    '.cache', '.vscode', '.idea', 'coverage', '.DS_Store', 'vendor',
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

// --- Main Component ---

export default function CodeViewer() {
    const [mode, setMode] = useState('samples'); // 'samples' | 'custom' | 'project'
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
        setProjectName(''); if (fileInputRef.current) fileInputRef.current.value = '';
    };

    useEffect(() => { setAiAnalysis(null); }, [selectedFile]);

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
                        /* Project view */
                        <>
                            <div className="code-viewer__header">
                                <span className="code-viewer__filename" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <FolderOpen size={14} color="#f59e0b" />
                                    {selectedProjectFile ? selectedProjectFile.path : `${projectName} — Overview`}
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
                                                ← Overview
                                            </button>
                                        </>
                                    )}
                                    <span className="code-viewer__lang-badge">
                                        {selectedProjectFile ? selectedProjectFile.language : `${projectFiles.length} files`}
                                    </span>
                                </div>
                            </div>

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

                                    {/* Ask AI input */}
                                    <div style={{
                                        display: 'flex', gap: 8, padding: '10px 14px',
                                        borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
                                    }}>
                                        <input
                                            value={helpQuestion}
                                            onChange={e => setHelpQuestion(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter' && helpQuestion.trim()) handleAskHelp(helpQuestion); }}
                                            placeholder="Ask AI about this file... (e.g., 'How does authentication work here?')"
                                            style={{
                                                flex: 1, padding: '8px 12px', borderRadius: 8,
                                                border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)',
                                                color: 'var(--text-primary)', fontSize: 12, outline: 'none',
                                            }}
                                        />
                                        <button
                                            onClick={() => helpQuestion.trim() && handleAskHelp(helpQuestion)}
                                            disabled={helpLoading || !helpQuestion.trim()}
                                            style={{
                                                padding: '8px 14px', border: 'none', borderRadius: 8,
                                                background: helpQuestion.trim() ? 'rgba(245,158,11,0.15)' : 'var(--bg-tertiary)',
                                                color: helpQuestion.trim() ? '#f59e0b' : 'var(--text-muted)',
                                                cursor: helpQuestion.trim() ? 'pointer' : 'default',
                                                display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600,
                                            }}
                                        >
                                            {helpLoading ? <Loader2 size={13} className="spin" /> : <Send size={13} />}
                                            Ask
                                        </button>
                                    </div>

                                    {/* AI help response */}
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
                            ) : (
                                /* Project overview */
                                <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
                                    {projectLoading ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
                                            <Loader2 size={32} className="spin" color="#f59e0b" />
                                            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Analyzing project architecture...</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.6 }}>
                                                Sending {projectFiles.length} files to Gemini AI
                                            </div>
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
                            )}
                        </>
                    )
                )}
            </div>

            <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
