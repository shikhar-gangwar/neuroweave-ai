import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Folder, FileText, ChevronRight, Bot, AlertCircle, Lightbulb, Info } from 'lucide-react';
import { fileTree, codeSnippets, aiAnnotations } from '../ai/codeData';

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

const annotationIcons = {
    info: Info,
    tip: Lightbulb,
    warning: AlertCircle,
    pattern: Bot,
};

export default function CodeViewer() {
    const [selectedFile, setSelectedFile] = useState('Header.jsx');
    const flatItems = flattenTree(fileTree);

    const snippet = codeSnippets[selectedFile];
    const annotations = aiAnnotations[selectedFile] || [];

    return (
        <div className="code-viewer">
            <div className="code-viewer__tree">
                {flatItems.map((item, idx) => (
                    <div
                        key={idx}
                        className={`code-tree__item ${item.type === 'folder' ? 'code-tree__item--folder' : ''} ${item.name === selectedFile ? 'code-tree__item--active' : ''}`}
                        style={{ paddingLeft: 16 + item.depth * 16 }}
                        onClick={() => {
                            if (item.type === 'file' && codeSnippets[item.name]) {
                                setSelectedFile(item.name);
                            }
                        }}
                    >
                        {item.type === 'folder' ? (
                            <>
                                <ChevronRight size={12} style={{ opacity: 0.5 }} />
                                <Folder size={14} color="#f59e0b" />
                            </>
                        ) : (
                            <FileText size={14} color="var(--accent-secondary)" />
                        )}
                        <span>{item.name}</span>
                    </div>
                ))}
            </div>

            <div className="code-viewer__content">
                {snippet ? (
                    <>
                        <div className="code-viewer__header">
                            <span className="code-viewer__filename">{selectedFile}</span>
                            <span className="code-viewer__lang-badge">{snippet.language}</span>
                        </div>
                        <div className="code-viewer__source">
                            <SyntaxHighlighter
                                language={snippet.language === 'jsx' ? 'jsx' : 'javascript'}
                                style={oneDark}
                                showLineNumbers
                                wrapLines
                                customStyle={{
                                    margin: 0,
                                    padding: '16px',
                                    background: '#0a0b14',
                                    fontSize: '13px',
                                    lineHeight: '1.7',
                                    minHeight: '100%',
                                }}
                                lineNumberStyle={{
                                    color: '#334155',
                                    fontSize: '12px',
                                    paddingRight: '16px',
                                    minWidth: '40px',
                                }}
                            >
                                {snippet.code}
                            </SyntaxHighlighter>
                        </div>
                        {annotations.length > 0 && (
                            <div className="code-annotations">
                                <div className="code-annotations__title">
                                    <Bot size={14} color="var(--accent-primary)" />
                                    AI Insights
                                </div>
                                {annotations.map((ann, i) => {
                                    const Icon = annotationIcons[ann.type] || Info;
                                    return (
                                        <div key={i} className="code-annotation">
                                            <span className={`code-annotation__badge code-annotation__badge--${ann.type}`}>
                                                {ann.type}
                                            </span>
                                            <span className="code-annotation__line">L{ann.line}</span>
                                            <span className="code-annotation__text">{ann.text}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                ) : (
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flex: 1, color: 'var(--text-muted)', fontSize: 14
                    }}>
                        Select a file to view its code and AI analysis
                    </div>
                )}
            </div>
        </div>
    );
}
