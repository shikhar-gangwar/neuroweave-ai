const fileTree = [
    {
        name: 'src',
        type: 'folder',
        children: [
            {
                name: 'components',
                type: 'folder',
                children: [
                    { name: 'Header.jsx', type: 'file', language: 'jsx' },
                    { name: 'Sidebar.jsx', type: 'file', language: 'jsx' },
                    { name: 'Dashboard.jsx', type: 'file', language: 'jsx' },
                    { name: 'UserProfile.jsx', type: 'file', language: 'jsx' },
                ]
            },
            {
                name: 'hooks',
                type: 'folder',
                children: [
                    { name: 'useAuth.js', type: 'file', language: 'javascript' },
                    { name: 'useFetch.js', type: 'file', language: 'javascript' },
                ]
            },
            {
                name: 'services',
                type: 'folder',
                children: [
                    { name: 'api.js', type: 'file', language: 'javascript' },
                    { name: 'auth.js', type: 'file', language: 'javascript' },
                ]
            },
            { name: 'App.jsx', type: 'file', language: 'jsx' },
            { name: 'main.jsx', type: 'file', language: 'jsx' },
        ]
    },
    {
        name: 'server',
        type: 'folder',
        children: [
            { name: 'index.js', type: 'file', language: 'javascript' },
            {
                name: 'routes',
                type: 'folder',
                children: [
                    { name: 'users.js', type: 'file', language: 'javascript' },
                    { name: 'auth.js', type: 'file', language: 'javascript' },
                ]
            },
            {
                name: 'models',
                type: 'folder',
                children: [
                    { name: 'User.js', type: 'file', language: 'javascript' },
                ]
            }
        ]
    },
    { name: 'package.json', type: 'file', language: 'json' },
    { name: 'README.md', type: 'file', language: 'markdown' },
];

const codeSnippets = {
    'Header.jsx': {
        language: 'jsx',
        code: `import React from 'react';
import { useAuth } from '../hooks/useAuth';

const Header = () => {
  const { user, logout } = useAuth();

  return (
    <header className="app-header">
      <div className="logo">
        <h1>MyApp</h1>
      </div>
      <nav className="nav-links">
        <a href="/dashboard">Dashboard</a>
        <a href="/profile">Profile</a>
        <a href="/settings">Settings</a>
      </nav>
      <div className="user-menu">
        {user ? (
          <>
            <span>{user.name}</span>
            <button onClick={logout}>Logout</button>
          </>
        ) : (
          <a href="/login">Login</a>
        )}
      </div>
    </header>
  );
};

export default Header;`
    },
    'useAuth.js': {
        language: 'javascript',
        code: `import { useState, useEffect, createContext, useContext } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const token = localStorage.getItem('auth_token');
    if (token) {
      validateToken(token)
        .then(user => setUser(user))
        .catch(() => localStorage.removeItem('auth_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    localStorage.setItem('auth_token', data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);`
    },
    'api.js': {
        language: 'javascript',
        code: `const API_BASE = process.env.REACT_APP_API_URL || '/api';

class ApiService {
  constructor() {
    this.baseUrl = API_BASE;
  }

  async request(endpoint, options = {}) {
    const token = localStorage.getItem('auth_token');
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: \`Bearer \${token}\` }),
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(
      \`\${this.baseUrl}\${endpoint}\`,
      config
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'API Error');
    }

    return response.json();
  }

  get(endpoint) {
    return this.request(endpoint);
  }

  post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

export default new ApiService();`
    },
    'index.js': {
        language: 'javascript',
        code: `const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/users', require('./routes/users'));
app.use('/api/auth', require('./routes/auth'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Internal Server Error' 
  });
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});`
    },
    'User.js': {
        language: 'javascript',
        code: `const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: 50,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/\\S+@\\S+\\.\\S+/, 'Invalid email'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 8,
    select: false,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);`
    }
};

const aiAnnotations = {
    'Header.jsx': [
        { line: 2, type: 'info', text: 'Custom hook import — useAuth provides authentication context' },
        { line: 5, type: 'pattern', text: 'Destructuring pattern — extracts user and logout from auth context' },
        { line: 15, type: 'tip', text: 'Consider using React Router NavLink for active state styling' },
    ],
    'useAuth.js': [
        { line: 1, type: 'info', text: 'Context + Provider pattern — standard React auth architecture' },
        { line: 8, type: 'warning', text: 'Token stored in localStorage — consider httpOnly cookies for production' },
        { line: 20, type: 'pattern', text: 'Async validation on mount — checks if existing session is still valid' },
    ],
    'api.js': [
        { line: 5, type: 'pattern', text: 'Service class pattern — encapsulates all API communication' },
        { line: 10, type: 'info', text: 'Bearer token pattern — automatically attaches auth header' },
        { line: 18, type: 'tip', text: 'Consider adding request/response interceptors for error handling' },
    ],
};

export { fileTree, codeSnippets, aiAnnotations };
