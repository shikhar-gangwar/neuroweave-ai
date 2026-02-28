import React, { useMemo } from 'react';
import { TrendingUp, AlertTriangle, Lightbulb, ChevronRight } from 'lucide-react';
import { getSkillData } from '../ai/engine';
import { groupColors } from '../ai/knowledgeData';

export default function SkillPanel() {
    const { skills, overallScore, weakAreas, suggestedTopics } = useMemo(() => getSkillData(), []);

    const circumference = 2 * Math.PI * 52;
    const offset = circumference - (overallScore / 100) * circumference;

    return (
        <div className="skill-panel">
            {/* Overall Score */}
            <div className="skill-panel__section">
                <div className="skill-panel__title">Knowledge Score</div>
                <div className="score-circle">
                    <svg width="130" height="130" viewBox="0 0 130 130">
                        <defs>
                            <linearGradient id="score-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#6366f1" />
                                <stop offset="50%" stopColor="#a855f7" />
                                <stop offset="100%" stopColor="#ec4899" />
                            </linearGradient>
                        </defs>
                        <circle className="score-circle__bg" cx="65" cy="65" r="52" />
                        <circle
                            className="score-circle__fill"
                            cx="65" cy="65" r="52"
                            strokeDasharray={circumference}
                            strokeDashoffset={offset}
                        />
                    </svg>
                    <div className="score-circle__value">
                        <div className="score-circle__number">{overallScore}</div>
                        <div className="score-circle__label">Overall</div>
                    </div>
                </div>
            </div>

            {/* Skill Breakdown */}
            <div className="skill-panel__section">
                <div className="skill-panel__title">Skill Breakdown</div>
                {skills.map(skill => (
                    <div className="skill-bar" key={skill.group}>
                        <div className="skill-bar__header">
                            <span className="skill-bar__name">{skill.group}</span>
                            <span className="skill-bar__value">{skill.avgMastery}%</span>
                        </div>
                        <div className="skill-bar__track">
                            <div
                                className="skill-bar__fill"
                                style={{
                                    width: `${skill.avgMastery}%`,
                                    backgroundColor: groupColors[skill.group] || 'var(--accent-primary)',
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {/* Weak Areas */}
            <div className="skill-panel__section">
                <div className="skill-panel__title">
                    <AlertTriangle size={13} style={{ display: 'inline', marginRight: 6, color: 'var(--danger)' }} />
                    Weak Areas
                </div>
                {weakAreas.map(area => (
                    <div className="weak-item" key={area.id}>
                        <span className="weak-item__name">{area.label}</span>
                        <span className="weak-item__score">{area.mastery}%</span>
                    </div>
                ))}
            </div>

            {/* Suggested Topics */}
            <div className="skill-panel__section">
                <div className="skill-panel__title">
                    <Lightbulb size={13} style={{ display: 'inline', marginRight: 6, color: 'var(--warning)' }} />
                    Suggested Next
                </div>
                {suggestedTopics.map(topic => (
                    <div className="suggestion-item" key={topic.id}>
                        <span className="suggestion-item__name">{topic.label}</span>
                        <ChevronRight size={14} className="suggestion-item__arrow" />
                    </div>
                ))}
            </div>
        </div>
    );
}
