import React, { useMemo } from 'react';
import { Clock, BarChart2, Target, ChevronRight, Sparkles } from 'lucide-react';
import { getLearningPath } from '../ai/engine';
import { groupColors } from '../ai/knowledgeData';

export default function LearningPath() {
    const steps = useMemo(() => getLearningPath(), []);

    return (
        <div className="learning-path">
            <div className="learning-path__header">
                <h2 className="learning-path__title">
                    <Sparkles size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
                    Your Adaptive Learning Path
                </h2>
                <p className="learning-path__subtitle">
                    AI-generated curriculum based on your knowledge gaps · {steps.length} topics to master
                </p>
            </div>

            <div className="learning-path__timeline">
                {steps.map((step, idx) => (
                    <div
                        key={step.id}
                        className={`learning-step ${step.current ? 'learning-step--current' : ''} ${step.completed ? 'learning-step--completed' : ''}`}
                    >
                        <div className="learning-step__top">
                            <span className="learning-step__title">
                                <span
                                    style={{
                                        display: 'inline-block',
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        backgroundColor: groupColors[step.group] || 'var(--accent-primary)',
                                        marginRight: 8,
                                        boxShadow: `0 0 6px ${groupColors[step.group] || 'var(--accent-primary)'}40`,
                                    }}
                                />
                                {step.title}
                            </span>
                            <span className={`learning-step__badge learning-step__badge--${step.difficulty.toLowerCase()}`}>
                                {step.difficulty}
                            </span>
                        </div>
                        <div className="learning-step__desc">{step.description}</div>
                        <div className="learning-step__meta">
                            <span><Clock size={13} /> {step.estimatedTime}</span>
                            <span><Target size={13} /> {step.group}</span>
                            <span><BarChart2 size={13} /> Step {idx + 1} of {steps.length}</span>
                        </div>
                        <div className="learning-step__mastery">
                            <div className="learning-step__mastery-bar">
                                <div
                                    className="learning-step__mastery-fill"
                                    style={{
                                        width: `${step.mastery}%`,
                                        background: step.mastery > 50
                                            ? 'var(--accent-primary)'
                                            : step.mastery > 30
                                                ? 'var(--warning)'
                                                : 'var(--danger)'
                                    }}
                                />
                            </div>
                            <span className="learning-step__mastery-text">{step.mastery}%</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
