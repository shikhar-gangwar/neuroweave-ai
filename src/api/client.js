const API_BASE = '/api';

async function request(endpoint, options = {}) {
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        ...options,
    };

    const response = await fetch(`${API_BASE}${endpoint}`, config);

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || 'API Error');
    }

    return response.json();
}

// Chat API
export async function sendChatQuery(query, userId = 'default') {
    return request('/chat', {
        method: 'POST',
        body: JSON.stringify({ query, userId }),
    });
}

// Knowledge API
export async function fetchKnowledgeGraph(userId = 'default') {
    return request(`/knowledge/graph?userId=${userId}`);
}

export async function fetchNodeDetail(nodeId, userId = 'default') {
    return request(`/knowledge/node/${nodeId}?userId=${userId}`);
}

export async function searchConcepts(query) {
    return request('/knowledge/search', {
        method: 'POST',
        body: JSON.stringify({ query }),
    });
}

// Progress API
export async function fetchProgress(userId = 'default') {
    return request(`/progress/${userId}`);
}

export async function updateProgress(userId = 'default', topicId, delta = 5) {
    return request(`/progress/${userId}/update`, {
        method: 'POST',
        body: JSON.stringify({ topicId, delta }),
    });
}

export async function fetchLearningPath(userId = 'default') {
    return request(`/progress/${userId}/learning-path`);
}

export async function completeLearningStep(userId = 'default', topicId) {
    return request(`/progress/${userId}/complete`, {
        method: 'POST',
        body: JSON.stringify({ topicId }),
    });
}

// Code API
export async function analyzeCode(code, language = 'javascript') {
    return request('/code/analyze', {
        method: 'POST',
        body: JSON.stringify({ code, language }),
    });
}

export async function explainCode(code, language = 'javascript') {
    return request('/code/explain', {
        method: 'POST',
        body: JSON.stringify({ code, language }),
    });
}

export async function fetchFileTree() {
    return request('/code/files');
}

export async function fetchSampleFile(fileId) {
    return request(`/code/sample/${fileId}`);
}

// Project analysis API
export async function analyzeProjectAPI(files, structure) {
    return request('/code/project-analyze', {
        method: 'POST',
        body: JSON.stringify({ files, structure }),
    });
}

export async function getProjectFileHelp(code, language = 'javascript', projectContext = '', question = '') {
    return request('/code/project-file-help', {
        method: 'POST',
        body: JSON.stringify({ code, language, projectContext, question }),
    });
}

// Code review API
export async function reviewProjectAPI(files, structure) {
    return request('/code/project-review', {
        method: 'POST',
        body: JSON.stringify({ files, structure }),
    });
}

// Auto README generator
export async function generateReadmeAPI(files, structure) {
    return request('/code/generate-readme', {
        method: 'POST',
        body: JSON.stringify({ files, structure }),
    });
}

// Error explainer
export async function explainErrorAPI(errorText, language = '') {
    return request('/code/explain-error', {
        method: 'POST',
        body: JSON.stringify({ errorText, language }),
    });
}

// Health check
export async function checkHealth() {
    return request('/health');
}
