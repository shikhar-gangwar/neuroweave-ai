import React, { useRef, useCallback, useState, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { fetchKnowledgeGraph } from '../api/client';
import { knowledgeGraph as fallbackGraph, groupColors as fallbackColors } from '../ai/knowledgeData';

export default function KnowledgeGraph() {
    const graphRef = useRef();
    const [hoveredNode, setHoveredNode] = useState(null);
    const [selectedNode, setSelectedNode] = useState(null);
    const containerRef = useRef(null);
    const [graphData, setGraphData] = useState(null);
    const [groupColors, setGroupColors] = useState(fallbackColors);

    // Fetch graph data
    useEffect(() => {
        const processData = (data, colors) => ({
            nodes: data.nodes.map(n => ({
                ...n,
                val: 4 + (n.mastery / 15),
                color: n.color || colors[n.group],
            })),
            links: data.links.map(l => ({ source: l.source, target: l.target })),
        });

        fetchKnowledgeGraph()
            .then(data => {
                if (data.groupColors) setGroupColors(data.groupColors);
                setGraphData(processData(data, data.groupColors || fallbackColors));
            })
            .catch(() => {
                setGraphData(processData(fallbackGraph, fallbackColors));
            });
    }, []);

    // Configure forces after graph mounts
    useEffect(() => {
        if (!graphRef.current || !graphData) return;
        const fg = graphRef.current;

        // Strong repulsion + long links = no overlaps
        fg.d3Force('charge').strength(-350).distanceMax(400);
        fg.d3Force('link').distance(90).strength(0.3);
        if (fg.d3Force('center')) fg.d3Force('center').strength(0.05);

        // Zoom to fit after simulation settles
        setTimeout(() => {
            try { fg.zoomToFit(400, 60); } catch (e) { }
        }, 1500);
    }, [graphData]);

    // Custom node painting
    const paintNode = useCallback((node, ctx, globalScale) => {
        const size = node.val * 1.4;
        const isHovered = hoveredNode?.id === node.id;
        const isSelected = selectedNode?.id === node.id;
        const isActive = isHovered || isSelected;

        // Glow
        if (isActive) {
            ctx.shadowColor = node.color;
            ctx.shadowBlur = 24;
        }

        // Mastery ring
        const ringRadius = size + 5;
        const masteryAngle = (node.mastery / 100) * 2 * Math.PI;

        // Ring background
        ctx.beginPath();
        ctx.arc(node.x, node.y, ringRadius, 0, 2 * Math.PI);
        ctx.strokeStyle = `${node.color}20`;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Mastery arc
        ctx.beginPath();
        ctx.arc(node.x, node.y, ringRadius, -Math.PI / 2, -Math.PI / 2 + masteryAngle);
        ctx.strokeStyle = node.color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.lineCap = 'butt';

        // Hover halo
        if (isActive) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, size + 10, 0, 2 * Math.PI);
            ctx.fillStyle = `${node.color}12`;
            ctx.fill();
        }

        // Main circle with gradient
        const gradient = ctx.createRadialGradient(
            node.x - size * 0.3, node.y - size * 0.3, 0,
            node.x, node.y, size
        );
        gradient.addColorStop(0, lightenColor(node.color, 30));
        gradient.addColorStop(1, node.color);
        ctx.beginPath();
        ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.shadowBlur = 0;

        // Glass highlight
        ctx.beginPath();
        ctx.arc(node.x - size * 0.2, node.y - size * 0.2, size * 0.35, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fill();

        // Label below
        const fontSize = isActive ? 11 : Math.min(11, Math.max(8, 11 / Math.sqrt(globalScale)));
        ctx.font = `${isActive ? '700' : '500'} ${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Text shadow
        ctx.fillStyle = '#0a0b14';
        ctx.fillText(node.label, node.x + 0.5, node.y + ringRadius + 5.5);
        ctx.fillText(node.label, node.x - 0.5, node.y + ringRadius + 4.5);
        ctx.fillStyle = isActive ? '#f1f5f9' : '#94a3b8';
        ctx.fillText(node.label, node.x, node.y + ringRadius + 5);

        // Mastery % inside node
        if (isActive || globalScale > 0.8) {
            ctx.font = `700 ${Math.max(8, size * 0.65)}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.fillText(`${node.mastery}`, node.x, node.y);
        }
    }, [hoveredNode, selectedNode]);

    // Custom link painting
    const paintLink = useCallback((link, ctx) => {
        const sourceColor = link.source.color || '#6366f1';
        const isHighlighted = hoveredNode?.id === link.source.id || hoveredNode?.id === link.target.id;
        ctx.strokeStyle = isHighlighted ? `${sourceColor}50` : `${sourceColor}15`;
        ctx.lineWidth = isHighlighted ? 1.5 : 0.8;
        ctx.beginPath();
        ctx.moveTo(link.source.x, link.source.y);
        ctx.lineTo(link.target.x, link.target.y);
        ctx.stroke();
    }, [hoveredNode]);

    const handleNodeClick = useCallback((node) => {
        setSelectedNode(prev => prev?.id === node.id ? null : node);
        if (graphRef.current) {
            graphRef.current.centerAt(node.x, node.y, 500);
            graphRef.current.zoom(2.5, 500);
        }
    }, []);

    if (!graphData) {
        return (
            <div className="graph-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                Loading knowledge graph...
            </div>
        );
    }

    const activeNode = selectedNode || hoveredNode;

    return (
        <div className="graph-container" ref={containerRef}>
            <ForceGraph2D
                ref={graphRef}
                graphData={graphData}
                nodeCanvasObject={paintNode}
                linkCanvasObject={paintLink}
                onNodeHover={setHoveredNode}
                onNodeClick={handleNodeClick}
                nodeLabel={() => ''}
                backgroundColor="#0a0b14"
                d3AlphaDecay={0.015}
                d3VelocityDecay={0.25}
                cooldownTicks={200}
                warmupTicks={50}
                enableZoomInteraction={true}
                enablePanInteraction={true}
                minZoom={0.5}
                maxZoom={6}
            />

            {/* Tooltip */}
            {activeNode && (
                <div className="graph-tooltip" style={{ pointerEvents: selectedNode ? 'auto' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{
                            width: 10, height: 10, borderRadius: '50%',
                            backgroundColor: activeNode.color, flexShrink: 0,
                        }} />
                        <div className="graph-tooltip__title">{activeNode.label}</div>
                        <span style={{
                            marginLeft: 'auto', fontSize: 11, fontWeight: 600,
                            color: activeNode.mastery > 60 ? '#10b981' : activeNode.mastery > 35 ? '#f59e0b' : '#ef4444',
                            fontFamily: 'var(--font-mono)',
                        }}>{activeNode.mastery}%</span>
                    </div>
                    <div className="graph-tooltip__desc">{activeNode.description}</div>
                    <div className="graph-tooltip__mastery">
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Mastery</span>
                        <div className="graph-tooltip__mastery-bar">
                            <div
                                className="graph-tooltip__mastery-fill"
                                style={{
                                    width: `${activeNode.mastery}%`,
                                    background: activeNode.mastery > 60
                                        ? 'linear-gradient(90deg, #10b981, #34d399)'
                                        : activeNode.mastery > 35
                                            ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                                            : 'linear-gradient(90deg, #ef4444, #f87171)',
                                }}
                            />
                        </div>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, textTransform: 'capitalize' }}>
                        Category: {activeNode.group}
                    </div>
                </div>
            )}

            {/* Legend */}
            <div className="graph-legend">
                {Object.entries(groupColors).map(([group, color]) => (
                    <div className="graph-legend__item" key={group}>
                        <span className="graph-legend__dot" style={{ backgroundColor: color }} />
                        {group}
                    </div>
                ))}
            </div>

            {/* Controls hint */}
            <div style={{
                position: 'absolute', top: 12, right: 12,
                fontSize: 10, color: 'var(--text-muted)', opacity: 0.5,
                display: 'flex', gap: 12,
            }}>
                <span>🖱️ Scroll to zoom</span>
                <span>👆 Click node for details</span>
                <span>✋ Drag to pan</span>
            </div>
        </div>
    );
}

function lightenColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, (num >> 16) + percent);
    const g = Math.min(255, ((num >> 8) & 0x00FF) + percent);
    const b = Math.min(255, (num & 0x0000FF) + percent);
    return `rgb(${r},${g},${b})`;
}
