import { knowledgeGraph } from './knowledgeData';

const responses = {
    react_hooks: {
        title: 'React Hooks Explained',
        content: `**React Hooks** are functions that let you "hook into" React state and lifecycle features from function components.

### Core Hooks:

**useState** — Adds state to functional components
\`\`\`jsx
const [count, setCount] = useState(0);
\`\`\`

**useEffect** — Runs side effects (API calls, subscriptions)
\`\`\`jsx
useEffect(() => {
  fetchData();
  return () => cleanup();
}, [dependency]);
\`\`\`

**useContext** — Accesses context without nesting consumers

**useRef** — Persists values across renders without triggering re-renders

### Key Rules:
1. Only call hooks at the top level
2. Only call hooks from React functions
3. Custom hooks must start with "use"

Hooks replaced class components for most use cases, making code more concise and reusable.`,
        relatedTopics: ['react', 'hooks', 'state', 'context'],
        codeExample: `// Custom Hook Example
function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : initialValue;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}`,
    },
    rest_api: {
        title: 'REST API Architecture',
        content: `**REST (Representational State Transfer)** is an architectural style for designing web APIs.

### Core Principles:
- **Stateless** — Each request contains all information needed
- **Resource-based** — URLs represent resources, not actions
- **HTTP Methods** — GET, POST, PUT, DELETE map to CRUD operations
- **Uniform Interface** — Consistent URL patterns

### HTTP Methods:
| Method | Purpose | Example |
|--------|---------|---------|
| GET | Read | \`GET /api/users\` |
| POST | Create | \`POST /api/users\` |
| PUT | Update | \`PUT /api/users/1\` |
| DELETE | Remove | \`DELETE /api/users/1\` |

### Best Practices:
1. Use nouns for endpoints (not verbs)
2. Version your API (\`/api/v1/\`)
3. Return proper HTTP status codes
4. Implement pagination for lists
5. Use HATEOAS for discoverability`,
        relatedTopics: ['rest', 'express', 'node', 'graphql'],
        codeExample: `// Express REST API
app.get('/api/users', async (req, res) => {
  const users = await User.find().limit(20);
  res.json({ data: users, count: users.length });
});

app.post('/api/users', async (req, res) => {
  const user = await User.create(req.body);
  res.status(201).json(user);
});`,
    },
    docker: {
        title: 'Docker Containerization',
        content: `**Docker** packages applications into lightweight, portable containers.

### Key Concepts:
- **Image** — Blueprint/template (read-only)
- **Container** — Running instance of an image
- **Dockerfile** — Instructions for building an image
- **Volume** — Persistent data storage
- **Network** — Container communication

### Lifecycle:
Build Image → Create Container → Start → Stop → Remove

### Why Docker?
1. Consistent environments (dev = prod)
2. Isolation between services
3. Fast startup (seconds vs minutes for VMs)
4. Easy scaling and deployment
5. Smaller footprint than VMs`,
        relatedTopics: ['docker', 'k8s', 'ci_cd'],
        codeExample: `# Dockerfile for Node.js App
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]`,
    },
    authentication: {
        title: 'Authentication & Security',
        content: `**Authentication** verifies user identity. **Authorization** determines access level.

### Common Strategies:

**JWT (JSON Web Tokens)**
- Stateless authentication
- Token stored client-side
- Contains encoded user claims

**OAuth 2.0**
- Delegated authorization
- Used for "Login with Google/GitHub"
- Access tokens + refresh tokens

**Session-Based**
- Server stores session data
- Client sends session ID cookie
- More secure but less scalable

### Security Best Practices:
1. Hash passwords (bcrypt/argon2)
2. Use HTTPS everywhere
3. Implement rate limiting
4. Validate and sanitize inputs
5. Set secure cookie flags
6. Rotate secrets regularly`,
        relatedTopics: ['auth', 'jwt', 'oauth'],
        codeExample: `// JWT Authentication Middleware
const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const token = req.headers.authorization
    ?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ 
      error: 'Token required' 
    });
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid token' });
  }
}`,
    },
    database: {
        title: 'Database Design Patterns',
        content: `**Databases** store and manage structured data for applications.

### SQL vs NoSQL:

| Feature | SQL (PostgreSQL) | NoSQL (MongoDB) |
|---------|-----------------|-----------------|
| Schema | Fixed/Rigid | Flexible |
| Joins | Native | Manual/$lookup |
| Scale | Vertical | Horizontal |
| ACID | Full | Configurable |
| Best For | Complex relations | Rapid iteration |

### Key Patterns:
- **Connection Pooling** — Reuse DB connections
- **Indexing** — Speed up queries on frequent columns
- **Caching** — Redis for hot data
- **Migrations** — Version-controlled schema changes
- **ORM** — Object-Relational Mapping (Prisma, Sequelize)`,
        relatedTopics: ['sql', 'postgres', 'mongodb', 'redis'],
        codeExample: `// Prisma ORM Example
const users = await prisma.user.findMany({
  where: { 
    role: 'admin',
    createdAt: { gte: thirtyDaysAgo }
  },
  include: { posts: true },
  orderBy: { name: 'asc' },
  take: 10,
});`,
    },
    default: {
        title: 'NeuroWeave AI Analysis',
        content: `I've analyzed your query using our cognitive reasoning engine. Here's what I found:

### Understanding Your Question
I've mapped your query to relevant concepts in our knowledge graph and identified the key areas you might be exploring.

### Recommended Learning Path:
1. **Start with fundamentals** — Ensure core concepts are solid
2. **Build something** — Apply knowledge through a project
3. **Review patterns** — Understand common design patterns
4. **Deep dive** — Explore advanced topics

### Quick Tips:
- Use the **Knowledge Graph** tab to see how concepts connect
- Check your **Skill Panel** for knowledge gaps
- Follow the **Learning Path** for structured progression

Would you like me to explain any specific concept in detail?`,
        relatedTopics: ['react', 'node', 'sql'],
        codeExample: null,
    }
};

const intentPatterns = [
    { pattern: /react\s*hook|usestate|useeffect|use\s*context/i, key: 'react_hooks' },
    { pattern: /rest\s*api|http\s*method|endpoint|crud/i, key: 'rest_api' },
    { pattern: /docker|container|dockerfile|image/i, key: 'docker' },
    { pattern: /auth|login|jwt|token|oauth|session|password/i, key: 'authentication' },
    { pattern: /database|sql|mongo|postgres|redis|query|schema/i, key: 'database' },
];

function detectIntent(query) {
    for (const { pattern, key } of intentPatterns) {
        if (pattern.test(query)) {
            return key;
        }
    }
    return 'default';
}

function getResponse(query) {
    const intent = detectIntent(query);
    return responses[intent];
}

function simulateLatency() {
    return new Promise(resolve => {
        const delay = 200 + Math.random() * 400;
        setTimeout(resolve, delay);
    });
}

async function processQuery(query) {
    await simulateLatency();
    const response = getResponse(query);

    const latencyBreakdown = {
        parsing: Math.floor(80 + Math.random() * 80),
        intent: Math.floor(60 + Math.random() * 70),
        graphLookup: Math.floor(100 + Math.random() * 80),
        inference: Math.floor(150 + Math.random() * 120),
        generation: Math.floor(100 + Math.random() * 120),
    };
    latencyBreakdown.total = Object.values(latencyBreakdown).reduce((a, b) => a + b, 0);

    return {
        ...response,
        latency: latencyBreakdown,
        timestamp: Date.now(),
        queryId: Math.random().toString(36).substring(2, 10),
    };
}

function getSkillData() {
    const groups = {};
    knowledgeGraph.nodes.forEach(node => {
        if (!groups[node.group]) groups[node.group] = [];
        groups[node.group].push(node);
    });

    const skills = Object.entries(groups).map(([group, nodes]) => ({
        group,
        avgMastery: Math.round(nodes.reduce((s, n) => s + n.mastery, 0) / nodes.length),
        topics: nodes.map(n => ({ name: n.label, mastery: n.mastery })),
    }));

    const overallScore = Math.round(
        knowledgeGraph.nodes.reduce((s, n) => s + n.mastery, 0) / knowledgeGraph.nodes.length
    );

    const weakAreas = knowledgeGraph.nodes
        .filter(n => n.mastery < 40)
        .sort((a, b) => a.mastery - b.mastery)
        .slice(0, 5);

    const suggestedTopics = knowledgeGraph.nodes
        .filter(n => n.mastery >= 30 && n.mastery <= 60)
        .sort((a, b) => a.mastery - b.mastery)
        .slice(0, 5);

    return { skills, overallScore, weakAreas, suggestedTopics };
}

function getLearningPath() {
    const weak = knowledgeGraph.nodes
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
    }));
}

export { processQuery, getSkillData, getLearningPath, detectIntent };
