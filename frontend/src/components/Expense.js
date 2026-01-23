// components/Expense.js - Expense management component with month/year filtering
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import '../css/Expense.css';

// Configure axios base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
axios.defaults.baseURL = API_BASE_URL;

// Add request interceptor for debugging
axios.interceptors.request.use(
  config => {
    console.log('Making request to:', config.baseURL + config.url);
    return config;
  },
  error => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for better error handling
axios.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', {
      url: error.config?.url,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    return Promise.reject(error);
  }
);

const Expense = ({ user }) => {
  const [expenseData, setExpenseData] = useState({
    expenseTransactions: [],
    monthlyTotal: 0,
    yearlyTotal: 0,
    expensesByCategory: [],
    currentBalance: 0,
    pagination: {
      currentPage: 1,
      totalPages: 1,
      totalTransactions: 0,
      limit: 10
    }
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Form state
  const [formData, setFormData] = useState({
    category: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Predefined expense categories
  const expenseCategories = [
    'Food & Dining',
    'Transportation',
    'Housing',
    'Utilities',
    'Healthcare',
    'Entertainment',
    'Shopping',
    'Education',
    'Travel',
    'Insurance',
    'Debt Payment',
    'Groceries',
    'Gas & Fuel',
    'Personal Care',
    'Gifts & Donations',
    'Professional Services',
    'Subscriptions',
    'Maintenance',
    'Miscellaneous',
    'Other'
  ];

  // Updated colors for better visibility
  const COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', 
    '#FFCCCB', '#DDA0DD', '#F0E68C', '#FFB347', '#87CEEB',
    '#DEB887', '#F4A460', '#BC8F8F', '#CD853F', '#D2B48C',
    '#F5DEB3', '#FFE4E1', '#E6E6FA', '#F0F8FF', '#FDF5E6'
  ];

  // Fetch expense data with month/year filtering
  useEffect(() => {
    console.log('useEffect triggered with:', { userId: user?.id, currentPage, selectedMonth, selectedYear });
    if (user && user.id) {
      fetchExpenseData(user.id, currentPage, selectedMonth, selectedYear);
      fetchExpenseSummary(user.id, selectedMonth, selectedYear);
    }
  }, [user?.id, currentPage, selectedMonth, selectedYear]);

  const fetchExpenseData = async (userId, page = 1, month, year) => {
    if (!userId) {
      setError('User ID is required');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log(`Fetching expense data for user ${userId}, page ${page}, month ${month}, year ${year}`);
      
      const response = await axios.get(`/api/expense/${userId}`, {
        params: {
          page: page,
          limit: 10,
          month: month,
          year: year
        },
        timeout: 10000
      });
      
      console.log('Expense data response:', response.data);

      if (response.data && response.data.success) {
        setExpenseData(prev => ({
          ...prev,
          expenseTransactions: response.data.data.expenseTransactions || [],
          pagination: response.data.data.pagination || prev.pagination
        }));
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error fetching expense data:', error);
      
      let errorMessage = 'Failed to fetch expense data';
      
      if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Cannot connect to server. Please ensure the backend server is running on port 5000.';
      } else if (error.response) {
        errorMessage = `Server error: ${error.response.status} - ${error.response.data?.error || error.response.statusText}`;
      } else if (error.request) {
        errorMessage = 'No response from server. Please check your internet connection and server status.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchExpenseSummary = async (userId, month, year) => {
    if (!userId) {
      console.log('No user ID provided for summary');
      return;
    }

    try {
      console.log(`Fetching expense summary for user ${userId}, month ${month}, year ${year}`);
      
      const response = await axios.get(`/api/expense-summary/${userId}`, {
        params: {
          month: month,
          year: year
        },
        timeout: 10000
      });
      
      console.log('Expense summary response:', response.data);

      if (response.data && response.data.success) {
        const categoryData = response.data.data.expensesByCategory || [];
        
        const processedCategoryData = categoryData.map(item => ({
          category: item.category,
          total: parseFloat(item.total) || 0,
          count: parseInt(item.count) || 0,
          name: item.category,
          value: parseFloat(item.total) || 0
        }));

        setExpenseData(prev => ({
          ...prev,
          monthlyTotal: parseFloat(response.data.data.monthlyTotal) || 0,
          yearlyTotal: parseFloat(response.data.data.yearlyTotal) || 0,
          expensesByCategory: processedCategoryData,
          currentBalance: Math.max(0, parseFloat(response.data.data.currentBalance) || 0)
        }));
      }
    } catch (error) {
      console.error('Error fetching expense summary:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!user || !user.id) {
      setError('User information is missing');
      setLoading(false);
      return;
    }

    const expenseAmount = parseFloat(formData.amount);
    if (!editingTransaction && expenseAmount > expenseData.currentBalance) {
      setError(`Insufficient balance. Current balance: ₹${expenseData.currentBalance.toFixed(2)}, Expense amount: ₹${expenseAmount.toFixed(2)}`);
      setLoading(false);
      return;
    }

    try {
      const submitData = {
        user_id: user.id,
        ...formData,
        amount: expenseAmount
      };

      console.log('Submitting expense data:', submitData);

      let response;
      if (editingTransaction) {
        response = await axios.put(`/api/expense/${editingTransaction.id}`, submitData, {
          timeout: 10000
        });
      } else {
        response = await axios.post('/api/expense', submitData, {
          timeout: 10000
        });
      }

      if (response.data && response.data.success) {
        setSuccess(editingTransaction ? 'Expense updated successfully!' : 'Expense added successfully!');
        setShowForm(false);
        setEditingTransaction(null);
        setFormData({
          category: '',
          amount: '',
          date: new Date().toISOString().split('T')[0],
          notes: ''
        });
        
        await fetchExpenseData(user.id, currentPage, selectedMonth, selectedYear);
        await fetchExpenseSummary(user.id, selectedMonth, selectedYear);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Error submitting expense:', error);
      
      let errorMessage = 'Failed to submit expense';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Cannot connect to server. Please check if the server is running.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (transaction) => {
    setFormData({
      category: transaction.category,
      amount: transaction.amount.toString(),
      date: new Date(transaction.date).toISOString().split('T')[0],
      notes: transaction.notes || ''
    });
    setEditingTransaction(transaction);
    setShowForm(true);
  };

  const handleDelete = async (transactionId) => {
    if (!window.confirm('Are you sure you want to delete this expense transaction?')) {
      return;
    }

    if (!user || !user.id) {
      setError('User information is missing');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.delete(`/api/expense/${transactionId}`, {
        params: { user_id: user.id },
        timeout: 10000
      });
      
      if (response.data && response.data.success) {
        setSuccess('Expense deleted successfully!');
        await fetchExpenseData(user.id, currentPage, selectedMonth, selectedYear);
        await fetchExpenseSummary(user.id, selectedMonth, selectedYear);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Error deleting expense:', error);
      
      let errorMessage = 'Failed to delete expense';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleMonthYearChange = (month, year) => {
    console.log('Month/Year changed to:', month, year);
    setSelectedMonth(month);
    setSelectedYear(year);
    setCurrentPage(1);
    
    if (user && user.id) {
      fetchExpenseData(user.id, 1, month, year);
      fetchExpenseSummary(user.id, month, year);
    }
  };

  const resetForm = () => {
    setFormData({
      category: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setEditingTransaction(null);
    setShowForm(false);
    setError('');
    setSuccess('');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  // Custom tooltip for pie chart
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{`${payload[0].name}`}</p>
          <p className="tooltip-amount" style={{ color: payload[0].color }}>
            {`Amount: ${formatCurrency(payload[0].value)}`}
          </p>
          <p className="tooltip-percentage">
            {`${((payload[0].value / expenseData.monthlyTotal) * 100).toFixed(1)}% of total`}
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom label function for pie chart
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.05) return null;
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize="12"
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  // Auto-clear messages
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  if (!user) {
    return (
      <div className="expense-container">
        <div className="error-message">
          Please log in to view expense data.
        </div>
      </div>
    );
  }

  return (
    <div className="expense-container">
      {/* Header Section */}
      <div className="expense-header">
        <div className="header-content">
          <h1>Expense Management</h1>
          <p>Track and manage your expenses</p>
          
          {/* Month/Year Selector */}
          <div className="month-year-selector">
            <select
              value={selectedMonth}
              onChange={(e) => handleMonthYearChange(parseInt(e.target.value), selectedYear)}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2024, i).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => handleMonthYearChange(selectedMonth, parseInt(e.target.value))}
            >
              {Array.from({ length: 5 }, (_, i) => (
                <option key={2024 + i} value={2024 + i}>
                  {2024 + i}
                </option>
              ))}
            </select>
          </div>

          {/* Balance Display */}
          
        </div>
        <button 
          className="add-expense-btn"
          onClick={() => setShowForm(true)}
          disabled={loading || expenseData.currentBalance <= 0}
        >
          + Add Expense
        </button>
      </div>

      {/* Messages */}
      {error && <div className="message error">{error}</div>}
      {success && <div className="message success">{success}</div>}

      {expenseData.currentBalance <= 100 && expenseData.currentBalance > 0 && (
        <div className="warning-message">
          ⚠️ Low Balance Warning: Your current balance is only {formatCurrency(expenseData.currentBalance)}
        </div>
      )}

      {/* Summary Cards */}
      <div className="summary-section">
        <div className="summary-cards">
          <div className="summary-card monthly">
            <div className="card-header">
              <h3>Selected Month</h3>
              <div className="card-icon">💸</div>
            </div>
            <div className="card-amount">{formatCurrency(expenseData.monthlyTotal)}</div>
            <div className="card-subtitle">
              {new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
            </div>
          </div>

          <div className="summary-card yearly">
            <div className="card-header">
              <h3>This Year</h3>
              <div className="card-icon">📊</div>
            </div>
            <div className="card-amount">{formatCurrency(expenseData.yearlyTotal)}</div>
            <div className="card-subtitle">Total Expenses</div>
          </div>

          <div className="summary-card balance">
            <div className="card-header">
              <h3>Available Balance</h3>
              <div className="card-icon">💰</div>
            </div>
            <div className={`card-amount ${expenseData.currentBalance <= 0 ? 'negative' : ''}`}>
              {formatCurrency(expenseData.currentBalance)}
            </div>
            <div className="card-subtitle">Current Balance</div>
          </div>

          <div className="summary-card average">
            <div className="card-header">
              <h3>Average per Category</h3>
              <div className="card-icon">📈</div>
            </div>
            <div className="card-amount">
              {expenseData.expensesByCategory.length > 0 
                ? formatCurrency(expenseData.monthlyTotal / expenseData.expensesByCategory.length)
                : formatCurrency(0)
              }
            </div>
            <div className="card-subtitle">Selected Month</div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      {expenseData.expensesByCategory.length > 0 && (
        <div className="charts-section">
          <div className="chart-container">
            <h3>Expenses by Category Distribution</h3>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={expenseData.expensesByCategory}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomizedLabel}
                    outerRadius={85}
                    fill="#8884d8"
                    dataKey="value"
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {expenseData.expensesByCategory.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[index % COLORS.length]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="bottom" 
                    height={30}
                    formatter={(value, entry) => (
                      <span className="legend-text" style={{ color: entry.color }}>
                        {value}
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-container">
            <h3>Expense Categories Breakdown</h3>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart 
                  data={expenseData.expensesByCategory}
                  margin={{ top: 10, right: 20, left: 10, bottom: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="category" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                    fontSize={10}
                  />
                  <YAxis 
                    tickFormatter={(value) => `₹${(value/1000).toFixed(0)}K`}
                    width={50}
                    fontSize={10}
                  />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="total" fill="#FF6B6B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Expense Form Modal */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingTransaction ? 'Edit Expense' : 'Add New Expense'}</h2>
              <button 
                className="modal-close"
                onClick={resetForm}
                disabled={loading}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="expense-form">
              {!editingTransaction && (
                <div className="balance-info">
                  <span>Available Balance: <strong>{formatCurrency(expenseData.currentBalance)}</strong></span>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="category">Category *</label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select Category</option>
                  {expenseCategories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="amount">Amount (₹) *</label>
                <input
                  type="number"
                  id="amount"
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
                  min="0.01"
                  max={!editingTransaction ? expenseData.currentBalance : undefined}
                  step="0.01"
                  required
                  placeholder="Enter amount"
                />
                {!editingTransaction && parseFloat(formData.amount) > expenseData.currentBalance && (
                  <div className="form-error">
                    Amount exceeds available balance of {formatCurrency(expenseData.currentBalance)}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="date">Date *</label>
                <input
                  type="date"
                  id="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="notes">Notes</label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Optional notes about this expense"
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={resetForm}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading || (!editingTransaction && parseFloat(formData.amount) > expenseData.currentBalance)}
                >
                  {loading ? 'Saving...' : (editingTransaction ? 'Update Expense' : 'Add Expense')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expense Transactions List */}
      <div className="transactions-section">
        <div className="section-header">
          <h2>Expense Transactions</h2>
          <div className="transactions-count">
            {expenseData.pagination.totalTransactions} total transactions for {new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
          </div>
        </div>

        {loading && !showForm ? (
          <div className="loading-state">Loading expense transactions...</div>
        ) : expenseData.expenseTransactions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💸</div>
            <h3>No Expense Transactions Yet</h3>
            <p>No transactions found for {new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}.</p>
            {expenseData.currentBalance > 0 && (
              <button 
                className="btn-primary"
                onClick={() => setShowForm(true)}
              >
                Add Your First Expense
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="transactions-list">
              {expenseData.expenseTransactions.map((transaction) => (
                <div key={transaction.id} className="transaction-item">
                  <div className="transaction-info">
                    <div className="transaction-icon">💸</div>
                    <div className="transaction-details">
                      <div className="transaction-category">{transaction.category}</div>
                      <div className="transaction-date">
                        {new Date(transaction.date).toLocaleDateString()}
                      </div>
                      {transaction.notes && (
                        <div className="transaction-notes">{transaction.notes}</div>
                      )}
                    </div>
                  </div>
                  <div className="transaction-amount">
                    {formatCurrency(transaction.amount)}
                  </div>
                  <div className="transaction-actions">
                    <button
                      className="btn-edit"
                      onClick={() => handleEdit(transaction)}
                      disabled={loading}
                      title="Edit transaction"
                    >
                      ✏️
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => handleDelete(transaction.id)}
                      disabled={loading}
                      title="Delete transaction"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {expenseData.pagination.totalPages > 1 && (
              <div className="pagination">
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                >
                  Previous
                </button>
                
                <div className="pagination-info">
                  Page {expenseData.pagination.currentPage} of {expenseData.pagination.totalPages}
                </div>
                
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === expenseData.pagination.totalPages || loading}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Expense;