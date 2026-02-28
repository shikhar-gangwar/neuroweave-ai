import React, { useState } from 'react';
import MetricsBar from './components/MetricsBar';
import Sidebar from './components/Sidebar';
import AIChat from './components/AIChat';
import KnowledgeGraph from './components/KnowledgeGraph';
import CodeViewer from './components/CodeViewer';
import LearningPath from './components/LearningPath';
import SkillPanel from './components/SkillPanel';
import { MessageSquare, Network, Code2, Route } from 'lucide-react';

const tabs = [
    { id: 'chat', label: 'AI Chat', icon: MessageSquare },
    { id: 'graph', label: 'Knowledge Graph', icon: Network },
    { id: 'code', label: 'Code Explorer', icon: Code2 },
    { id: 'path', label: 'Learning Path', icon: Route },
];

export default function App() {
    const [activeTab, setActiveTab] = useState('chat');
    const [activeNavItem, setActiveNavItem] = useState('chat');

    const handleNavClick = (id) => {
        setActiveNavItem(id);
        if (['chat', 'graph', 'code', 'path'].includes(id)) {
            setActiveTab(id);
        }
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'chat': return <AIChat />;
            case 'graph': return <KnowledgeGraph />;
            case 'code': return <CodeViewer />;
            case 'path': return <LearningPath />;
            default: return <AIChat />;
        }
    };

    return (
        <div className="app-layout">
            <MetricsBar />
            <div className="app-body">
                <Sidebar activeItem={activeNavItem} onItemClick={handleNavClick} />
                <div className="center-panel">
                    <div className="tab-bar">
                        {tabs.map(tab => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    className={`tab-bar__item ${activeTab === tab.id ? 'tab-bar__item--active' : ''}`}
                                    onClick={() => { setActiveTab(tab.id); setActiveNavItem(tab.id); }}
                                >
                                    <Icon size={15} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                    {renderTabContent()}
                </div>
                <SkillPanel />
            </div>
        </div>
    );
}
