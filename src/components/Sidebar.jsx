import React from 'react';
import {
    MessageSquare, Network, Code2, Route,
    BookOpen, History, Settings, HelpCircle,
    Brain
} from 'lucide-react';
import { knowledgeGraph, groupColors } from '../ai/knowledgeData';

const navItems = [
    { id: 'chat', label: 'AI Chat', icon: MessageSquare },
    { id: 'graph', label: 'Knowledge Graph', icon: Network },
    { id: 'code', label: 'Code Explorer', icon: Code2 },
    { id: 'path', label: 'Learning Path', icon: Route },
];

const bottomItems = [
    { id: 'help', label: 'Help & Docs', icon: HelpCircle },
    { id: 'settings', label: 'Settings', icon: Settings },
];

const topTopics = knowledgeGraph.nodes
    .sort((a, b) => b.mastery - a.mastery)
    .slice(0, 8);

export default function Sidebar({ activeItem, onItemClick }) {
    return (
        <aside className="sidebar">
            <nav className="sidebar__nav">
                {navItems.map(item => {
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.id}
                            className={`sidebar__item ${activeItem === item.id ? 'sidebar__item--active' : ''}`}
                            onClick={() => onItemClick(item.id)}
                        >
                            <Icon size={18} className="sidebar__item-icon" />
                            <span>{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            <div className="sidebar__divider" />

            <div className="sidebar__section-title">Quick Topics</div>
            <div className="sidebar__topics">
                {topTopics.map(topic => (
                    <div key={topic.id} className="sidebar__topic" onClick={() => onItemClick('chat')}>
                        <span>{topic.label}</span>
                        <span
                            className="sidebar__topic-dot"
                            style={{
                                backgroundColor: groupColors[topic.group],
                                boxShadow: `0 0 6px ${groupColors[topic.group]}40`
                            }}
                        />
                    </div>
                ))}
            </div>

            <div className="sidebar__divider" />

            <nav className="sidebar__nav" style={{ marginTop: 'auto' }}>
                {bottomItems.map(item => {
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.id}
                            className={`sidebar__item ${activeItem === item.id ? 'sidebar__item--active' : ''}`}
                            onClick={() => onItemClick(item.id)}
                        >
                            <Icon size={18} className="sidebar__item-icon" />
                            <span>{item.label}</span>
                        </button>
                    );
                })}
            </nav>
        </aside>
    );
}
