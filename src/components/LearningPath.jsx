import React, { useState, useEffect } from 'react';
import { Clock, BarChart2, Target, CheckCircle, Sparkles } from 'lucide-react';
import { fetchLearningPath, completeLearningStep as apiCompleteStep } from '../api/client';
import { getLearningPath as fallbackLearningPath } from '../ai/engine';
import { groupColors } from '../ai/knowledgeData';

export default function LearningPath() {
    const [steps, setSteps] = useState([]);
    const [completedCount, setCompletedCount] = useState(0);
    const [completing, setCompleting] = useState(null);

    useEffect(() => {
        fetchLearningPath()
            .then(data => {
                setSteps(data.path);
                setCompletedCount(data.completedCount || 0);
            })
            .catch(() => {
                setSteps(fallbackLearningPath());
            });
    }, []);

    const handleComplete = async (topicId) => {
        setCompleting(topicId);
        try {
            await apiCompleteStep('default', topicId);
            setSteps(prev => prev.map(s =>
                s.id === topicId ? { ...s, completed: true, current: false } : s
            ));
            setCompletedCount(prev => prev + 1);
            // Notify skill panel to refresh
            window.dispatchEvent(new CustomEvent('neuroweave:progress-updated'));
        } catch (err) {
            console.error('Failed to complete step:', err);
        } finally {
            setCompleting(null);
        }
    };

    // Find first incomplete step and mark as current
    const stepsWithCurrent = steps.map((step, idx) => {
        const firstIncomplete = steps.findIndex(s => !s.completed);
        return {
            ...step,
            current: !step.completed && idx === firstIncomplete,
        };
    });

    return (
        <div className="learning-path">
            <div className="learning-path__header">
                <h2 className="learning-path__title">
                    <Sparkles size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
                    Your Adaptive Learning Path
                </h2>
                <p className="learning-path__subtitle">
                    AI-generated curriculum based on your knowledge gaps · {steps.length} topics · {completedCount} completed
                </p>
            </div>

            <div className="learning-path__timeline">
                {stepsWithCurrent.map((step, idx) => (
                    <div
                        key={step.id}
                        className={`learning-step ${step.current ? 'learning-step--current' : ''} ${step.completed ? 'learning-step--completed' : ''}`}
                    >
                        <div className="learning-step__top">
                            <span className="learning-step__title">
                                <span
                                    style={{
                                        display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                                        backgroundColor: groupColors[step.group] || 'var(--accent-primary)',
                                        marginRight: 8, boxShadow: `0 0 6px ${groupColors[step.group] || 'var(--accent-primary)'}40`,
                                    }}
                                />
                                {step.title}
                                {step.completed && <CheckCircle size={15} color="var(--success)" style={{ marginLeft: 8 }} />}
                            </span>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                {!step.completed && (
                                    <button
                                        onClick={() => handleComplete(step.id)}
                                        disabled={completing === step.id}
                                        style={{
                                            padding: '4px 10px', border: '1px solid var(--border-color)',
                                            borderRadius: 8, background: 'rgba(16,185,129,0.1)', color: 'var(--success)',
                                            fontSize: 11, fontWeight: 600, cursor: completing === step.id ? 'wait' : 'pointer',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        {completing === step.id ? '...' : '✓ Complete'}
                                    </button>
                                )}
                                <span className={`learning-step__badge learning-step__badge--${step.difficulty.toLowerCase()}`}>
                                    {step.difficulty}
                                </span>
                            </div>
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
                                        width: `${step.completed ? 100 : step.mastery}%`,
                                        background: step.completed ? 'var(--success)'
                                            : step.mastery > 50 ? 'var(--accent-primary)'
                                                : step.mastery > 30 ? 'var(--warning)' : 'var(--danger)'
                                    }}
                                />
                            </div>
                            <span className="learning-step__mastery-text">
                                {step.completed ? '100' : step.mastery}%
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
