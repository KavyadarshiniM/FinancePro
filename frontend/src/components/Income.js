// components/Income.js - Income management component with month/year filtering
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import '../css/Income.css';

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

const Income = ({ user }) => {
  const [incomeData, setIncomeData] = useState({
    incomeTransactions: [],
    monthlyTotal: 0,
    yearlyTotal: 0,
    incomeByCategory: [],
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

  // Predefined income categories
  const incomeCategories = [
    'Salary',
    'Freelance',
    'Business Income',
    'Investment Returns',
    'Rental Income',
    'Bonus',
    'Commission',
    'Dividends',
    'Interest',
    'Gift/Inheritance',
    'Side Hustle',
    'Refund',
    'Other'
  ];

  const COLORS = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#00BCD4', '#FFC107', '#795548'];

  // Fetch income data with month/year filtering
  useEffect(() => {
    console.log('useEffect triggered with:', { userId: user?.id, currentPage, selectedMonth, selectedYear });
    if (user && user.id) {
      fetchIncomeData(user.id, currentPage, selectedMonth, selectedYear);
      fetchIncomeSummary(user.id, selectedMonth, selectedYear);
    }
  }, [user?.id, currentPage, selectedMonth, selectedYear]);

  const fetchIncomeData = async (userId, page = 1, month, year) => {
    if (!userId) {
      setError('User ID is required');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log(`Fetching income data for user ${userId}, page ${page}, month ${month}, year ${year}`);
      
      const response = await axios.get(`/api/income/${userId}`, {
        params: {
          page: page,
          limit: 10,
          month: month,
          year: year
        },
        timeout: 10000
      });
      
      console.log('Income data response:', response.data);

      if (response.data && response.data.success) {
        setIncomeData(prev => ({
          ...prev,
          incomeTransactions: response.data.data.incomeTransactions || [],
          pagination: response.data.data.pagination || prev.pagination
        }));
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error fetching income data:', error);
      
      let errorMessage = 'Failed to fetch income data';
      
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

  const fetchIncomeSummary = async (userId, month, year) => {
    if (!userId) {
      console.log('No user ID provided for summary');
      return;
    }

    try {
      console.log(`Fetching income summary for user ${userId}, month ${month}, year ${year}`);
      console.log('Request params:', { month, year });
      
      const response = await axios.get(`/api/income-summary/${userId}`, {
        params: {
          month: month,
          year: year
        },
        timeout: 10000
      });
      
      console.log('Income summary response:', response.data);

      if (response.data && response.data.success) {
        const categoryData = response.data.data.incomeByCategory || [];
        
        const processedCategoryData = categoryData.map(item => ({
          category: item.category,
          total: parseFloat(item.total) || 0,
          count: parseInt(item.count) || 0,
          name: item.category,
          value: parseFloat(item.total) || 0
        }));

        console.log('Processed category data:', processedCategoryData);

        setIncomeData(prev => ({
          ...prev,
          monthlyTotal: parseFloat(response.data.data.monthlyTotal) || 0,
          yearlyTotal: parseFloat(response.data.data.yearlyTotal) || 0,
          incomeByCategory: processedCategoryData
        }));
      }
    } catch (error) {
      console.error('Error fetching income summary:', error);
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

    try {
      const submitData = {
        user_id: user.id,
        ...formData,
        amount: parseFloat(formData.amount)
      };

      console.log('Submitting income data:', submitData);

      let response;
      if (editingTransaction) {
        response = await axios.put(`/api/income/${editingTransaction.id}`, submitData, {
          timeout: 10000
        });
      } else {
        response = await axios.post('/api/income', submitData, {
          timeout: 10000
        });
      }

      if (response.data && response.data.success) {
        setSuccess(editingTransaction ? 'Income updated successfully!' : 'Income added successfully!');
        setShowForm(false);
        setEditingTransaction(null);
        setFormData({
          category: '',
          amount: '',
          date: new Date().toISOString().split('T')[0],
          notes: ''
        });
        
        // Force refresh with current filters
        await fetchIncomeData(user.id, currentPage, selectedMonth, selectedYear);
        await fetchIncomeSummary(user.id, selectedMonth, selectedYear);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Error submitting income:', error);
      
      let errorMessage = 'Failed to submit income';
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
    if (!window.confirm('Are you sure you want to delete this income transaction?')) {
      return;
    }

    if (!user || !user.id) {
      setError('User information is missing');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.delete(`/api/income/${transactionId}`, {
        params: { user_id: user.id },
        timeout: 10000
      });
      
      if (response.data && response.data.success) {
        setSuccess('Income deleted successfully!');
        await fetchIncomeData(user.id, currentPage, selectedMonth, selectedYear);
        await fetchIncomeSummary(user.id, selectedMonth, selectedYear);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Error deleting income:', error);
      
      let errorMessage = 'Failed to delete income';
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
    
    // Force immediate data refresh
    if (user && user.id) {
      fetchIncomeData(user.id, 1, month, year);
      fetchIncomeSummary(user.id, month, year);
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
            {`${((payload[0].value / incomeData.monthlyTotal) * 100).toFixed(1)}% of total`}
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

  // Connection test function
  const testConnection = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.get('/api/test', { timeout: 5000 });
      setSuccess('Server connection successful!');
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        setError('Cannot connect to server. Please start your backend server on port 5000.');
      } else {
        setError(`Connection test failed: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="income-container">
        <div className="error-message">
          Please log in to view income data.
        </div>
      </div>
    );
  }

  return (
    <div className="income-container">
      {/* Header Section */}
      <div className="income-header">
        <div className="header-content">
          <h1>Income Management</h1>
          <p>Track and manage your income sources</p>
          
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

          {error && error.includes('server') && (
            <button 
              className="btn-test-connection"
              onClick={testConnection}
              disabled={loading}
            >
              Test Server Connection
            </button>
          )}
        </div>
        <button 
          className="add-income-btn"
          onClick={() => setShowForm(true)}
          disabled={loading}
        >
          + Add Income
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="message error">
          {error}
          {error.includes('server') && (
            <div className="troubleshooting">
              <strong>Troubleshooting steps:</strong>
              <ul>
                <li>Ensure your backend server is running on port 5000</li>
                <li>Check if the API routes are properly configured</li>
                <li>Verify your database connection</li>
              </ul>
            </div>
          )}
        </div>
      )}
      {success && <div className="message success">{success}</div>}

      {/* Summary Cards */}
      <div className="summary-section">
        <div className="summary-cards">
          <div className="summary-card monthly">
            <div className="card-header">
              <h3>Selected Month</h3>
              <div className="card-icon">💰</div>
            </div>
            <div className="card-amount">{formatCurrency(incomeData.monthlyTotal)}</div>
            <div className="card-subtitle">
              {new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
            </div>
          </div>

          <div className="summary-card yearly">
            <div className="card-header">
              <h3>This Year</h3>
              <div className="card-icon">📈</div>
            </div>
            <div className="card-amount">{formatCurrency(incomeData.yearlyTotal)}</div>
            <div className="card-subtitle">Total Income</div>
          </div>

          <div className="summary-card average">
            <div className="card-header">
              <h3>Average per Source</h3>
              <div className="card-icon">📊</div>
            </div>
            <div className="card-amount">
              {incomeData.incomeByCategory.length > 0 
                ? formatCurrency(incomeData.monthlyTotal / incomeData.incomeByCategory.length)
                : formatCurrency(0)
              }
            </div>
            <div className="card-subtitle">Selected Month</div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      {incomeData.incomeByCategory && incomeData.incomeByCategory.length > 0 && (
        <div className="charts-section">
          <div className="chart-container">
            <h3>Income by Category Distribution</h3>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={incomeData.incomeByCategory}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomizedLabel}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {incomeData.incomeByCategory.map((entry, index) => (
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
            <h3>Income Sources Breakdown</h3>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={incomeData.incomeByCategory} margin={{ top: 10, right: 20, left: 10, bottom: 70 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="category" 
                    angle={-45}
                    textAnchor="end"
                    height={70}
                    interval={0}
                    fontSize={10}
                  />
                  <YAxis 
                    tickFormatter={(value) => `₹${(value/1000).toFixed(0)}K`}
                    width={50}
                    fontSize={10}
                  />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="total" fill="#4CAF50" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Empty state for charts */}
      {(!incomeData.incomeByCategory || incomeData.incomeByCategory.length === 0) && (
        <div className="charts-section">
          <div className="chart-container">
            <h3>Income Analytics</h3>
            <div className="chart-empty-state">
              <p>No data available for charts for {new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}. Add some income transactions to see visual analytics.</p>
            </div>
          </div>
        </div>
      )}

      {/* Income Form Modal */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingTransaction ? 'Edit Income' : 'Add New Income'}</h2>
              <button 
                className="modal-close"
                onClick={resetForm}
                disabled={loading}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="income-form">
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
                  {incomeCategories.map(category => (
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
                  step="0.01"
                  required
                  placeholder="Enter amount"
                />
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
                  placeholder="Optional notes about this income"
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
                  disabled={loading}
                >
                  {loading ? 'Saving...' : (editingTransaction ? 'Update Income' : 'Add Income')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Income Transactions List */}
      <div className="transactions-section">
        <div className="section-header">
          <h2>Income Transactions</h2>
          <div className="transactions-count">
            {incomeData.pagination.totalTransactions} total transactions for {new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
          </div>
        </div>

        {loading && !showForm ? (
          <div className="loading-state">Loading income transactions...</div>
        ) : incomeData.incomeTransactions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💰</div>
            <h3>No Income Transactions Yet</h3>
            <p>No transactions found for {new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}.</p>
            <button 
              className="btn-primary"
              onClick={() => setShowForm(true)}
            >
              Add Your First Income
            </button>
          </div>
        ) : (
          <>
            <div className="transactions-list">
              {incomeData.incomeTransactions.map((transaction) => (
                <div key={transaction.id} className="transaction-item">
                  <div className="transaction-info">
                    <div className="transaction-icon">💰</div>
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
            {incomeData.pagination.totalPages > 1 && (
              <div className="pagination">
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                >
                  Previous
                </button>
                
                <div className="pagination-info">
                  Page {incomeData.pagination.currentPage} of {incomeData.pagination.totalPages}
                </div>
                
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === incomeData.pagination.totalPages || loading}
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

export default Income;