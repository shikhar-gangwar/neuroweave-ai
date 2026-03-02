import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Bot, User, Clock, Hash, Sparkles } from 'lucide-react';
import { sendChatQuery } from '../api/client';

const suggestions = [
    'Explain React Hooks',
    'How do REST APIs work?',
    'What is Docker?',
    'Database design patterns',
    'JWT authentication flow',
];

function parseMarkdown(text) {
    const lines = text.split('\n');
    const elements = [];
    let inCodeBlock = false;
    let codeLines = [];
    let inList = false;
    let listItems = [];
    let listType = 'ul';

    const flushList = () => {
        if (listItems.length > 0) {
            if (listType === 'ol') {
                elements.push(<ol key={`ol-${elements.length}`}>{listItems.map((li, i) => <li key={i}>{li}</li>)}</ol>);
            } else {
                elements.push(<ul key={`ul-${elements.length}`}>{listItems.map((li, i) => <li key={i}>{li}</li>)}</ul>);
            }
            listItems = [];
            inList = false;
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith('```')) {
            if (inCodeBlock) {
                elements.push(
                    <pre key={`code-${i}`}><code>{codeLines.join('\n')}</code></pre>
                );
                codeLines = [];
                inCodeBlock = false;
            } else {
                flushList();
                inCodeBlock = true;
            }
            continue;
        }

        if (inCodeBlock) {
            codeLines.push(line);
            continue;
        }

        if (line.startsWith('### ')) {
            flushList();
            elements.push(<h3 key={`h3-${i}`}>{formatInline(line.slice(4))}</h3>);
        } else if (line.startsWith('## ')) {
            flushList();
            elements.push(<h3 key={`h2-${i}`}>{formatInline(line.slice(3))}</h3>);
        } else if (line.startsWith('# ')) {
            flushList();
            elements.push(<h3 key={`h1-${i}`}>{formatInline(line.slice(2))}</h3>);
        } else if (/^\d+\.\s/.test(line)) {
            listType = 'ol';
            inList = true;
            listItems.push(formatInline(line.replace(/^\d+\.\s/, '')));
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
            listType = 'ul';
            inList = true;
            listItems.push(formatInline(line.slice(2)));
        } else if (line.startsWith('| ') && line.endsWith(' |')) {
            flushList();
            const tableLines = [line];
            let j = i + 1;
            while (j < lines.length && lines[j].startsWith('|')) {
                tableLines.push(lines[j]);
                j++;
            }
            i = j - 1;
            elements.push(renderTable(tableLines, elements.length));
        } else if (line.startsWith('> ')) {
            flushList();
            elements.push(
                <blockquote key={`bq-${i}`} style={{
                    borderLeft: '3px solid var(--accent-primary)',
                    paddingLeft: 12,
                    margin: '8px 0',
                    color: 'var(--text-secondary)',
                    fontStyle: 'italic',
                }}>
                    {formatInline(line.slice(2))}
                </blockquote>
            );
        } else if (line.trim()) {
            flushList();
            elements.push(<p key={`p-${i}`}>{formatInline(line)}</p>);
        } else {
            flushList();
        }
    }

    flushList();
    return elements;
}

function formatInline(text) {
    const parts = [];
    const regex = /(\*\*(.+?)\*\*|`(.+?)`)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(text.slice(lastIndex, match.index));
        }
        if (match[2]) {
            parts.push(<strong key={match.index}>{match[2]}</strong>);
        } else if (match[3]) {
            parts.push(<code key={match.index}>{match[3]}</code>);
        }
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
    }
    return parts;
}

function renderTable(lines, keyBase) {
    const header = lines[0].split('|').filter(c => c.trim()).map(c => c.trim());
    const rows = lines.slice(2).map(line =>
        line.split('|').filter(c => c.trim()).map(c => c.trim())
    );

    return (
        <table key={`table-${keyBase}`}>
            <thead>
                <tr>{header.map((h, i) => <th key={i}>{h}</th>)}</tr>
            </thead>
            <tbody>
                {rows.map((row, i) => (
                    <tr key={i}>{row.map((cell, j) => <td key={j}>{formatInline(cell)}</td>)}</tr>
                ))}
            </tbody>
        </table>
    );
}

export default function AIChat() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    const handleSend = async (text) => {
        const query = text || input.trim();
        if (!query) return;

        setMessages(prev => [...prev, { role: 'user', content: query }]);
        setInput('');
        setIsTyping(true);

        try {
            const response = await sendChatQuery(query);
            setMessages(prev => [...prev, {
                role: 'ai',
                title: response.title,
                content: response.content,
                codeExample: response.codeExample,
                relatedTopics: response.relatedTopics,
                latency: response.latency,
                queryId: response.queryId,
                source: response.source,
            }]);
        } catch (err) {
            setMessages(prev => [...prev, {
                role: 'ai',
                content: `⚠️ Error: ${err.message}. Make sure the backend server is running (\`npm run server\`).`,
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="chat-container">
            <div className="chat-messages">
                {messages.length === 0 && !isTyping && (
                    <div className="chat-welcome">
                        <div className="chat-welcome__icon">
                            <Sparkles size={32} color="white" />
                        </div>
                        <h2 className="chat-welcome__title">How can I help you learn today?</h2>
                        <p className="chat-welcome__desc">
                            Ask me about any programming concept, debug your code, or let me create
                            a personalized learning path. Powered by Google Gemini AI.
                        </p>
                        <div className="chat-welcome__suggestions">
                            {suggestions.map(s => (
                                <button key={s} className="chat-welcome__suggestion" onClick={() => handleSend(s)}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div key={idx} className={`chat-msg chat-msg--${msg.role === 'user' ? 'user' : 'ai'}`}>
                        <div className="chat-msg__avatar">
                            {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                        </div>
                        <div className="chat-msg__body">
                            {msg.title && (
                                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--accent-secondary)' }}>
                                    {msg.title}
                                </h3>
                            )}
                            <div className="chat-msg__content">
                                {msg.role === 'user' ? msg.content : parseMarkdown(msg.content)}
                                {msg.codeExample && (
                                    <pre><code>{msg.codeExample}</code></pre>
                                )}
                            </div>
                            {msg.relatedTopics && msg.relatedTopics.length > 0 && (
                                <div className="chat-msg__related">
                                    {msg.relatedTopics.map(t => (
                                        <span key={t} className="chat-msg__related-tag">{t}</span>
                                    ))}
                                </div>
                            )}
                            {msg.latency && (
                                <div className="chat-msg__meta">
                                    <span><Clock size={12} /> {msg.latency.total}ms total</span>
                                    <span><Hash size={12} /> {msg.queryId}</span>
                                    <span>Inference: {msg.latency.inference}ms</span>
                                    {msg.source && <span>Source: {msg.source}</span>}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {isTyping && (
                    <div className="chat-msg chat-msg--ai">
                        <div className="chat-msg__avatar">
                            <Bot size={16} />
                        </div>
                        <div className="chat-msg__body">
                            <div className="chat-typing">
                                <span className="chat-typing__dot" />
                                <span className="chat-typing__dot" />
                                <span className="chat-typing__dot" />
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area">
                <div className="chat-input-wrap">
                    <input
                        className="chat-input"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask about any concept, code, or topic..."
                    />
                    <button className="chat-input-btn" title="Voice input">
                        <Mic size={18} />
                    </button>
                    <button
                        className="chat-input-btn chat-input-btn--send"
                        onClick={() => handleSend()}
                        title="Send"
                    >
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
