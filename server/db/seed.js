import { initDB, getOrCreateUser, updateTopicProgress } from './database.js';
import { knowledgeGraph } from '../data/knowledgeData.js';

console.log('🌱 Seeding NeuroWeave database...');

initDB();

// Create default user
const user = getOrCreateUser('default');
console.log(`  ✅ Default user created: ${user.id}`);

// Seed initial progress with base mastery values from knowledge graph
knowledgeGraph.nodes.forEach(node => {
    updateTopicProgress('default', node.id, node.mastery);
});
console.log(`  ✅ Seeded progress for ${knowledgeGraph.nodes.length} topics`);

console.log('🎉 Database seeded successfully!');
process.exit(0);
