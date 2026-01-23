// App.js - Main App Component
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Login from './components/Login';
import Signup from './components/Signup';
import Dashboard from './components/Dashboard';
import Income from './components/Income';
import Expense from './components/Expense';
import Reports from './components/Reports';
import Budgets from './components/Budgets';
import FloatingChatbot from './components/FloatingChatbot';
import './App.css';

// Set axios base URL
axios.defaults.baseURL = 'http://localhost:5000';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('login'); // 'login', 'signup', 'dashboard', 'income', 'expense', 'reports', 'budgets'
  const [activeTab, setActiveTab] = useState('dashboard'); // Track active navbar tab
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Check if user is logged in on app start
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
      setCurrentPage('dashboard');
      setActiveTab('dashboard');
    }
  }, []);

  // Auto-clear messages after 3 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage('');
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Handle login
  const handleLogin = async (email, password) => {
    setLoading(true);
    setMessage('');
    
    try {
      const response = await axios.post('/api/auth/login', { email, password });
      
      if (response.data.success) {
        setCurrentUser(response.data.user);
        localStorage.setItem('currentUser', JSON.stringify(response.data.user));
        setCurrentPage('dashboard');
        setActiveTab('dashboard');
        setMessage('Login successful!');
      }
    } catch (error) {
      setMessage(error.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Handle signup
  const handleSignup = async (name, email, password) => {
    setLoading(true);
    setMessage('');
    
    try {
      const response = await axios.post('/api/auth/signup', { name, email, password });
      
      if (response.data.success) {
        setCurrentUser(response.data.user);
        localStorage.setItem('currentUser', JSON.stringify(response.data.user));
        setCurrentPage('dashboard');
        setActiveTab('dashboard');
        setMessage('Account created successfully!');
      }
    } catch (error) {
      setMessage(error.response?.data?.error || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  // Handle logout
  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    setCurrentPage('login');
    setActiveTab('dashboard');
    setMessage('Logged out successfully!');
  };

  // Handle navigation
  const handleNavigation = (page) => {
    setCurrentPage(page);
    setActiveTab(page);
    setMessage(''); // Clear any existing messages
  };

  // Render current page content
  const renderPageContent = () => {
    switch (currentPage) {
      case 'login':
        return (
          <Login 
            onLogin={handleLogin}
            onSwitchToSignup={() => setCurrentPage('signup')}
          />
        );
      case 'signup':
        return (
          <Signup 
            onSignup={handleSignup}
            onSwitchToLogin={() => setCurrentPage('login')}
          />
        );
      case 'dashboard':
        return <Dashboard user={currentUser} onNavigate={handleNavigation} />;
      case 'income':
        return <Income user={currentUser} />;
      case 'expense':
        return <Expense user={currentUser} />;
      case 'reports':
        return <Reports user={currentUser} />;
      case 'budgets':
        return <Budgets user={currentUser} />;
      default:
        return <Dashboard user={currentUser} onNavigate={handleNavigation} />;
    }
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <h1>FINANCEPRO</h1>
        {currentUser && (
          <div className="user-info">
            <span>Welcome, {currentUser.name}!</span>
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </div>
        )}
      </header>

      {/* Navigation Bar - Only show when logged in */}
      {currentUser && (
        <nav className="navbar">
          <div className="nav-container">
            <button 
              className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => handleNavigation('dashboard')}
            >
              Dashboard
            </button>
            <button 
              className={`nav-item ${activeTab === 'income' ? 'active' : ''}`}
              onClick={() => handleNavigation('income')}
            >
              Income
            </button>
            <button 
              className={`nav-item ${activeTab === 'expense' ? 'active' : ''}`}
              onClick={() => handleNavigation('expense')}
            >
              Expense
            </button>
            <button 
              className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`}
              onClick={() => handleNavigation('reports')}
            >
              Reports
            </button>
            <button 
              className={`nav-item ${activeTab === 'budgets' ? 'active' : ''}`}
              onClick={() => handleNavigation('budgets')}
            >
              Budgets
            </button>
          </div>
        </nav>
      )}

      {/* Message Display */}
      {message && (
        <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      {/* Main Content */}
      <main className="main-content">
        {loading && <div className="loading">Loading...</div>}
        {renderPageContent()}
      </main>

      {/* Floating Chatbot - Only show when logged in */}
      {currentUser && <FloatingChatbot user={currentUser} />}
    </div>
  );
}

export default App;