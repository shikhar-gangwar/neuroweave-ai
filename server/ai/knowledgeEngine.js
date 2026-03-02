import { knowledgeGraph, groupColors } from '../data/knowledgeData.js';

function getFullGraph() {
    return {
        nodes: knowledgeGraph.nodes.map(n => ({
            ...n,
            color: groupColors[n.group],
            val: 3 + (n.mastery / 20),
        })),
        links: knowledgeGraph.links,
        groupColors,
    };
}

function getNode(nodeId) {
    const node = knowledgeGraph.nodes.find(n => n.id === nodeId);
    if (!node) return null;

    const connections = knowledgeGraph.links
        .filter(l => l.source === nodeId || l.target === nodeId)
        .map(l => {
            const otherId = l.source === nodeId ? l.target : l.source;
            return knowledgeGraph.nodes.find(n => n.id === otherId);
        })
        .filter(Boolean);

    return {
        ...node,
        color: groupColors[node.group],
        connections: connections.map(c => ({ id: c.id, label: c.label, mastery: c.mastery, group: c.group })),
    };
}

function searchConcepts(query) {
    const q = query.toLowerCase();
    return knowledgeGraph.nodes
        .filter(n => n.label.toLowerCase().includes(q) || n.description.toLowerCase().includes(q) || n.group.toLowerCase().includes(q))
        .map(n => ({ ...n, color: groupColors[n.group] }));
}

function getSkillData(progressOverrides = {}) {
    const groups = {};
    knowledgeGraph.nodes.forEach(node => {
        if (!groups[node.group]) groups[node.group] = [];
        const mastery = progressOverrides[node.id] !== undefined ? progressOverrides[node.id] : node.mastery;
        groups[node.group].push({ ...node, mastery });
    });

    const skills = Object.entries(groups).map(([group, nodes]) => ({
        group,
        avgMastery: Math.round(nodes.reduce((s, n) => s + n.mastery, 0) / nodes.length),
        topics: nodes.map(n => ({ id: n.id, name: n.label, mastery: n.mastery })),
    }));

    const allNodes = Object.values(groups).flat();
    const overallScore = Math.round(allNodes.reduce((s, n) => s + n.mastery, 0) / allNodes.length);

    const weakAreas = allNodes
        .filter(n => n.mastery < 40)
        .sort((a, b) => a.mastery - b.mastery)
        .slice(0, 5);

    const suggestedTopics = allNodes
        .filter(n => n.mastery >= 30 && n.mastery <= 60)
        .sort((a, b) => a.mastery - b.mastery)
        .slice(0, 5);

    return { skills, overallScore, weakAreas, suggestedTopics };
}

function generateLearningPath(progressOverrides = {}) {
    const allNodes = knowledgeGraph.nodes.map(n => ({
        ...n,
        mastery: progressOverrides[n.id] !== undefined ? progressOverrides[n.id] : n.mastery,
    }));

    const weak = allNodes
        .filter(n => n.mastery < 60)
        .sort((a, b) => a.mastery - b.mastery);

    return weak.map((node, i) => ({
        id: node.id,
        title: node.label,
        description: node.description,
        estimatedTime: `${Math.floor(20 + (60 - node.mastery) * 0.8)} min`,
        difficulty: node.mastery < 30 ? 'Advanced' : node.mastery < 50 ? 'Intermediate' : 'Beginner',
        completed: false,
        current: i === 0,
        mastery: node.mastery,
        group: node.group,
        color: groupColors[node.group],
    }));
}

function getAdjacent(nodeId) {
    return knowledgeGraph.links
        .filter(l => l.source === nodeId || l.target === nodeId)
        .map(l => l.source === nodeId ? l.target : l.source);
}

export {
    getFullGraph, getNode, searchConcepts, getSkillData,
    generateLearningPath, getAdjacent,
};
