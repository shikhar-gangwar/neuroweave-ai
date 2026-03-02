import React, { useRef, useCallback, useState, useMemo, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { fetchKnowledgeGraph } from '../api/client';
import { knowledgeGraph as fallbackGraph, groupColors as fallbackColors } from '../ai/knowledgeData';

export default function KnowledgeGraph() {
    const graphRef = useRef();
    const [hoveredNode, setHoveredNode] = useState(null);
    const containerRef = useRef(null);
    const [graphData, setGraphData] = useState(null);
    const [groupColors, setGroupColors] = useState(fallbackColors);

    useEffect(() => {
        fetchKnowledgeGraph()
            .then(data => {
                setGraphData({
                    nodes: data.nodes.map(n => ({
                        ...n,
                        val: 3 + (n.mastery / 20),
                        color: n.color || fallbackColors[n.group],
                    })),
                    links: data.links.map(l => ({ source: l.source, target: l.target })),
                });
                if (data.groupColors) setGroupColors(data.groupColors);
            })
            .catch(() => {
                // Fallback to static data
                setGraphData({
                    nodes: fallbackGraph.nodes.map(n => ({
                        ...n,
                        val: 3 + (n.mastery / 20),
                        color: fallbackColors[n.group],
                    })),
                    links: fallbackGraph.links.map(l => ({ source: l.source, target: l.target })),
                });
            });
    }, []);

    const paintNode = useCallback((node, ctx, globalScale) => {
        const size = node.val * 1.5;
        const isHovered = hoveredNode?.id === node.id;

        if (isHovered) {
            ctx.shadowColor = node.color;
            ctx.shadowBlur = 20;
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, size + 2, 0, 2 * Math.PI);
        ctx.fillStyle = isHovered ? node.color : `${node.color}30`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
        ctx.fillStyle = node.color;
        ctx.fill();

        const masteryAngle = (node.mastery / 100) * 2 * Math.PI;
        ctx.beginPath();
        ctx.arc(node.x, node.y, size + 4, -Math.PI / 2, -Math.PI / 2 + masteryAngle);
        ctx.strokeStyle = node.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.shadowBlur = 0;

        const fontSize = Math.max(10, 12 / globalScale);
        ctx.font = `${isHovered ? '600' : '500'} ${fontSize}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = isHovered ? '#f1f5f9' : '#94a3b8';
        ctx.fillText(node.label, node.x, node.y + size + 8);
    }, [hoveredNode]);

    const paintLink = useCallback((link, ctx) => {
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(link.source.x, link.source.y);
        ctx.lineTo(link.target.x, link.target.y);
        ctx.stroke();
    }, []);

    if (!graphData) {
        return (
            <div className="graph-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                Loading knowledge graph...
            </div>
        );
    }

    return (
        <div className="graph-container" ref={containerRef}>
            <ForceGraph2D
                ref={graphRef}
                graphData={graphData}
                nodeCanvasObject={paintNode}
                linkCanvasObject={paintLink}
                onNodeHover={setHoveredNode}
                nodeLabel={() => ''}
                backgroundColor="#0a0b14"
                d3AlphaDecay={0.02}
                d3VelocityDecay={0.3}
                cooldownTicks={100}
                enableZoomInteraction={true}
                enablePanInteraction={true}
            />

            {hoveredNode && (
                <div className="graph-tooltip">
                    <div className="graph-tooltip__title">{hoveredNode.label}</div>
                    <div className="graph-tooltip__desc">{hoveredNode.description}</div>
                    <div className="graph-tooltip__mastery">
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Mastery</span>
                        <div className="graph-tooltip__mastery-bar">
                            <div
                                className="graph-tooltip__mastery-fill"
                                style={{
                                    width: `${hoveredNode.mastery}%`,
                                    backgroundColor: hoveredNode.mastery > 60 ? '#10b981' :
                                        hoveredNode.mastery > 35 ? '#f59e0b' : '#ef4444'
                                }}
                            />
                        </div>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                            {hoveredNode.mastery}%
                        </span>
                    </div>
                </div>
            )}

            <div className="graph-legend">
                {Object.entries(groupColors).map(([group, color]) => (
                    <div className="graph-legend__item" key={group}>
                        <span className="graph-legend__dot" style={{ backgroundColor: color }} />
                        {group}
                    </div>
                ))}
            </div>
        </div>
    );
}
