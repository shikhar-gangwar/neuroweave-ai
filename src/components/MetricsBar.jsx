import React, { useState, useEffect } from 'react';
import { Activity, Clock, Users, Cpu, Zap } from 'lucide-react';

export default function MetricsBar() {
    const [metrics, setMetrics] = useState({
        responseTime: 412,
        queriesHandled: 12847,
        activeUsers: 3241,
        accuracy: 99.2,
    });

    useEffect(() => {
        const interval = setInterval(() => {
            setMetrics(prev => ({
                responseTime: Math.max(180, Math.min(725, prev.responseTime + (Math.random() - 0.5) * 30)),
                queriesHandled: prev.queriesHandled + Math.floor(Math.random() * 5),
                activeUsers: Math.max(2800, Math.min(3600, prev.activeUsers + Math.floor((Math.random() - 0.5) * 20))),
                accuracy: Math.max(98.5, Math.min(99.9, prev.accuracy + (Math.random() - 0.5) * 0.1)),
            }));
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="metrics-bar">
            <div className="metrics-bar__brand">
                <div className="metrics-bar__logo">
                    <Zap size={18} />
                </div>
                <div>
                    <div className="metrics-bar__title">NeuroWeave AI</div>
                    <div className="metrics-bar__subtitle">Cognitive Learning Co-pilot</div>
                </div>
            </div>

            <div className="metrics-bar__items">
                <div className="metric-item">
                    <span className="metric-item__label">Response Time</span>
                    <span className="metric-item__value metric-item__value--green">
                        {Math.round(metrics.responseTime)}ms
                    </span>
                </div>
                <div className="metric-item">
                    <span className="metric-item__label">Queries</span>
                    <span className="metric-item__value metric-item__value--blue">
                        {metrics.queriesHandled.toLocaleString()}
                    </span>
                </div>
                <div className="metric-item">
                    <span className="metric-item__label">Active Users</span>
                    <span className="metric-item__value metric-item__value--purple">
                        {metrics.activeUsers.toLocaleString()}
                    </span>
                </div>
                <div className="metric-item">
                    <span className="metric-item__label">Accuracy</span>
                    <span className="metric-item__value metric-item__value--yellow">
                        {metrics.accuracy.toFixed(1)}%
                    </span>
                </div>
            </div>

            <div className="metrics-bar__status">
                <span className="metrics-bar__dot" />
                All Systems Operational
            </div>
        </div>
    );
}
