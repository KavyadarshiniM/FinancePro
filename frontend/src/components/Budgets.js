"use client"

// components/Budget.js - Budget management component with expense mapping
import { useState, useEffect } from "react"
import axios from "axios"
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import "../css/Budget.css"

// Configure axios base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000"
axios.defaults.baseURL = API_BASE_URL

// Add request interceptor for debugging
axios.interceptors.request.use(
  (config) => {
    console.log("Making request to:", config.baseURL + config.url)
    return config
  },
  (error) => {
    console.error("Request error:", error)
    return Promise.reject(error)
  },
)

// Add response interceptor for better error handling
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API Error:", {
      url: error.config?.url,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
    })
    return Promise.reject(error)
  },
)

const Budget = ({ user }) => {
  const [budgetData, setBudgetData] = useState({
    budgets: [],
    analysis: {},
    summary: {
      totalBudgeted: 0,
      totalSpent: 0,
      totalRemaining: 0,
      overallPercentage: 0,
      categoriesOverBudget: 0,
      categoriesUnderBudget: 0,
      totalCategories: 0,
    },
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editingBudget, setEditingBudget] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  // Form state
  const [formData, setFormData] = useState({
    category: "",
    monthly_limit: "",
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  })

  // Predefined budget categories (same as expense categories for consistency)
  const budgetCategories = [
    "Food & Dining",
    "Transportation",
    "Housing",
    "Utilities",
    "Healthcare",
    "Entertainment",
    "Shopping",
    "Education",
    "Travel",
    "Insurance",
    "Debt Payment",
    "Groceries",
    "Gas & Fuel",
    "Personal Care",
    "Gifts & Donations",
    "Professional Services",
    "Subscriptions",
    "Maintenance",
    "Miscellaneous",
    "Other",
  ]

  // Colors for charts
  const COLORS = {
    under: "#10B981", // Green - Under budget
    warning: "#F59E0B", // Yellow - Warning (80%+ of budget)
    over: "#EF4444", // Red - Over budget
    no_budget: "#6B7280", // Gray - No budget set
  }

  // Fetch budget data
  useEffect(() => {
    if (user && user.id) {
      fetchBudgetData(user.id, selectedMonth, selectedYear)
      fetchBudgetAnalysis(user.id, selectedMonth, selectedYear)
    }
  }, [user, selectedMonth, selectedYear])

  const fetchBudgetData = async (userId, month, year) => {
    if (!userId) {
      setError("User ID is required")
      setLoading(false)
      return
    }

    setLoading(true)
    setError("")

    try {
      console.log(`Fetching budget data for user ${userId}, month ${month}, year ${year}`)

      const response = await axios.get(`/api/budget/${userId}`, {
        params: { month, year },
        timeout: 10000,
      })

      console.log("Budget data response:", response.data)

      if (response.data && response.data.success) {
        setBudgetData((prev) => ({
          ...prev,
          budgets: response.data.data.budgets || [],
        }))
      } else {
        throw new Error("Invalid response format")
      }
    } catch (error) {
      console.error("Error fetching budget data:", error)

      let errorMessage = "Failed to fetch budget data"

      if (error.code === "ECONNREFUSED") {
        errorMessage = "Cannot connect to server. Please ensure the backend server is running on port 5000."
      } else if (error.response) {
        errorMessage = `Server error: ${error.response.status} - ${error.response.data?.error || error.response.statusText}`
      } else if (error.request) {
        errorMessage = "No response from server. Please check your internet connection and server status."
      }

      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const fetchBudgetAnalysis = async (userId, month, year) => {
    if (!userId) {
      console.log("No user ID provided for analysis")
      return
    }

    try {
      console.log(`Fetching budget analysis for user ${userId}, month ${month}, year ${year}`)

      const response = await axios.get(`/api/budget-analysis/${userId}`, {
        params: { month, year },
        timeout: 10000,
      })

      console.log("Budget analysis response:", response.data)

      if (response.data && response.data.success) {
        setBudgetData((prev) => ({
          ...prev,
          analysis: response.data.data.categoryAnalysis || {},
          summary: response.data.data.summary || prev.summary,
        }))
      }
    } catch (error) {
      console.error("Error fetching budget analysis:", error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setLoading(true)

    if (!user || !user.id) {
      setError("User information is missing")
      setLoading(false)
      return
    }

    try {
      const submitData = {
        user_id: user.id,
        ...formData,
        monthly_limit: Number.parseFloat(formData.monthly_limit),
      }

      console.log("Submitting budget data:", submitData)

      let response
      if (editingBudget) {
        response = await axios.put(`/api/budget/${editingBudget.id}`, submitData, {
          timeout: 10000,
        })
      } else {
        response = await axios.post("/api/budget", submitData, {
          timeout: 10000,
        })
      }

      if (response.data && response.data.success) {
        setSuccess(editingBudget ? "Budget updated successfully!" : "Budget added successfully!")
        setShowForm(false)
        setEditingBudget(null)
        setFormData({
          category: "",
          monthly_limit: "",
          month: selectedMonth,
          year: selectedYear,
        })

        await fetchBudgetData(user.id, selectedMonth, selectedYear)
        await fetchBudgetAnalysis(user.id, selectedMonth, selectedYear)
      } else {
        throw new Error("Invalid response from server")
      }
    } catch (error) {
      console.error("Error submitting budget:", error)

      let errorMessage = "Failed to submit budget"
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error
      } else if (error.code === "ECONNREFUSED") {
        errorMessage = "Cannot connect to server. Please check if the server is running."
      }

      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (budget) => {
    setFormData({
      category: budget.category,
      monthly_limit: budget.monthly_limit.toString(),
      month: budget.month,
      year: budget.year,
    })
    setEditingBudget(budget)
    setShowForm(true)
  }

  const handleDelete = async (budgetId) => {
    if (!window.confirm("Are you sure you want to delete this budget?")) {
      return
    }

    if (!user || !user.id) {
      setError("User information is missing")
      return
    }

    setLoading(true)
    setError("")

    try {
      const response = await axios.delete(`/api/budget/${budgetId}`, {
        params: { user_id: user.id },
        timeout: 10000,
      })

      if (response.data && response.data.success) {
        setSuccess("Budget deleted successfully!")
        await fetchBudgetData(user.id, selectedMonth, selectedYear)
        await fetchBudgetAnalysis(user.id, selectedMonth, selectedYear)
      } else {
        throw new Error("Invalid response from server")
      }
    } catch (error) {
      console.error("Error deleting budget:", error)

      let errorMessage = "Failed to delete budget"
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error
      }

      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleMonthYearChange = (month, year) => {
    setSelectedMonth(month)
    setSelectedYear(year)
  }

  const resetForm = () => {
    setFormData({
      category: "",
      monthly_limit: "",
      month: selectedMonth,
      year: selectedYear,
    })
    setEditingBudget(null)
    setShowForm(false)
    setError("")
    setSuccess("")
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount)
  }

  const getStatusColor = (status) => {
    return COLORS[status] || COLORS.no_budget
  }

  const getStatusText = (status) => {
    switch (status) {
      case "under":
        return "Under Budget"
      case "warning":
        return "Near Limit"
      case "over":
        return "Over Budget"
      case "no_budget":
        return "No Budget Set"
      default:
        return "Unknown"
    }
  }

  // Prepare chart data
  const chartData = Object.entries(budgetData.analysis).map(([category, data]) => ({
    category: category.length > 15 ? category.substring(0, 15) + "..." : category,
    fullCategory: category,
    budgeted: data.budgeted,
    spent: data.spent,
    remaining: Math.max(0, data.remaining),
    percentage: data.percentage,
    status: data.status,
  }))

  // Auto-clear messages
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError("")
        setSuccess("")
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [error, success])

  // Connection test function
  const testConnection = async () => {
    setLoading(true)
    setError("")

    try {
      const response = await axios.get("/api/test", { timeout: 5000 })
      setSuccess("Server connection successful!")
    } catch (error) {
      if (error.code === "ECONNREFUSED") {
        setError("Cannot connect to server. Please start your backend server on port 5000.")
      } else {
        setError(`Connection test failed: ${error.message}`)
      }
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="budget-container">
        <div className="error-message">Please log in to view budget data.</div>
      </div>
    )
  }

  return (
    <div className="budget-container">
      {/* Header Section */}
      <div className="budget-header">
        <div className="header-content">
          <h1>Budget Management</h1>
          <p>Set budgets and track your spending against limits</p>

          {/* Month/Year Selector */}
          <div className="month-year-selector">
            <select
              value={selectedMonth}
              onChange={(e) => handleMonthYearChange(Number.parseInt(e.target.value), selectedYear)}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2024, i).toLocaleString("default", { month: "long" })}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => handleMonthYearChange(selectedMonth, Number.parseInt(e.target.value))}
            >
              {Array.from({ length: 5 }, (_, i) => (
                <option key={2024 + i} value={2024 + i}>
                  {2024 + i}
                </option>
              ))}
            </select>
          </div>

          {error && error.includes("server") && (
            <button className="btn-test-connection" onClick={testConnection} disabled={loading}>
              Test Server Connection
            </button>
          )}
        </div>
        <button className="add-budget-btn" onClick={() => setShowForm(true)} disabled={loading}>
          + Add Budget
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="message error">
          {error}
          {error.includes("server") && (
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
          <div className="summary-card total-budget">
            <div className="card-header">
              <h3>Total Budget</h3>
              <div className="card-icon">💰</div>
            </div>
            <div className="card-amount">{formatCurrency(budgetData.summary.totalBudgeted)}</div>
            <div className="card-subtitle">Monthly Limit</div>
          </div>

          <div className="summary-card total-spent">
            <div className="card-header">
              <h3>Total Spent</h3>
              <div className="card-icon">💸</div>
            </div>
            <div className="card-amount">{formatCurrency(budgetData.summary.totalSpent)}</div>
            <div className="card-subtitle">This Month</div>
          </div>

          <div className="summary-card remaining">
            <div className="card-header">
              <h3>Remaining</h3>
              <div className="card-icon">💵</div>
            </div>
            <div className={`card-amount ${budgetData.summary.totalRemaining < 0 ? "negative" : ""}`}>
              {formatCurrency(budgetData.summary.totalRemaining)}
            </div>
            <div className="card-subtitle">Available</div>
          </div>

          <div className="summary-card percentage">
            <div className="card-header">
              <h3>Budget Used</h3>
              <div className="card-icon">📊</div>
            </div>
            <div className={`card-amount ${budgetData.summary.overallPercentage > 100 ? "negative" : ""}`}>
              {budgetData.summary.overallPercentage.toFixed(1)}%
            </div>
            <div className="card-subtitle">Of Total Budget</div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      {chartData.length > 0 && (
        <div className="charts-section">
          <div className="chart-container">
            <h3>Budget vs Spending Comparison</h3>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="category" 
                    angle={-45} 
                    textAnchor="end" 
                    height={60} 
                    interval={0}
                    fontSize={10} 
                  />
                  <YAxis 
                    tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`}
                    width={50}
                    fontSize={10}
                  />
                  <Tooltip
                    formatter={(value, name) => [formatCurrency(value), name === "budgeted" ? "Budget" : "Spent"]}
                    labelFormatter={(label) => {
                      const item = chartData.find((d) => d.category === label)
                      return item ? item.fullCategory : label
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="budgeted" fill="#3B82F6" name="Budget" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="spent" fill="#EF4444" name="Spent" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-container">
            <h3>Budget Status Distribution</h3>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={Object.entries(budgetData.analysis).map(([category, data]) => ({
                      name: category,
                      value: data.spent,
                      status: data.status,
                    }))}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {Object.entries(budgetData.analysis).map(([category, data], index) => (
                      <Cell key={`cell-${index}`} fill={getStatusColor(data.status)} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend
                    formatter={(value) => <span className="legend-text">{value}</span>}
                    wrapperStyle={{ fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Budget Form Modal */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingBudget ? "Edit Budget" : "Add New Budget"}</h2>
              <button className="modal-close" onClick={resetForm} disabled={loading}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="budget-form">
              <div className="form-group">
                <label htmlFor="category">Category *</label>
                <select id="category" name="category" value={formData.category} onChange={handleInputChange} required>
                  <option value="">Select Category</option>
                  {budgetCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="monthly_limit">Monthly Limit (₹) *</label>
                <input
                  type="number"
                  id="monthly_limit"
                  name="monthly_limit"
                  value={formData.monthly_limit}
                  onChange={handleInputChange}
                  min="0.01"
                  step="0.01"
                  required
                  placeholder="Enter monthly budget limit"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="month">Month *</label>
                  <select id="month" name="month" value={formData.month} onChange={handleInputChange} required>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {new Date(2024, i).toLocaleString("default", { month: "long" })}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="year">Year *</label>
                  <select id="year" name="year" value={formData.year} onChange={handleInputChange} required>
                    {Array.from({ length: 5 }, (_, i) => (
                      <option key={2024 + i} value={2024 + i}>
                        {2024 + i}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={resetForm} disabled={loading}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? "Saving..." : editingBudget ? "Update Budget" : "Add Budget"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Budget Analysis Section */}
      <div className="analysis-section">
        <div className="section-header">
          <h2>Budget Analysis</h2>
          <div className="analysis-count">{Object.keys(budgetData.analysis).length} categories tracked</div>
        </div>

        {loading && !showForm ? (
          <div className="loading-state">Loading budget analysis...</div>
        ) : Object.keys(budgetData.analysis).length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <h3>No Budget Analysis Available</h3>
            <p>Start by creating budgets for different categories to see your spending analysis.</p>
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              Create Your First Budget
            </button>
          </div>
        ) : (
          <div className="analysis-list">
            {Object.entries(budgetData.analysis).map(([category, data]) => (
              <div key={category} className={`analysis-item ${data.status}`}>
                <div className="analysis-info">
                  <div className="analysis-category">
                    <span className="category-name">{category}</span>
                    <span className={`status-badge ${data.status}`}>{getStatusText(data.status)}</span>
                  </div>
                  <div className="analysis-details">
                    <div className="budget-bar">
                      <div className="budget-bar-bg">
                        <div
                          className={`budget-bar-fill ${data.status}`}
                          style={{ width: `${Math.min(100, data.percentage)}%` }}
                        ></div>
                      </div>
                      <span className="percentage-text">{data.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="amounts">
                      <span className="spent">{formatCurrency(data.spent)} spent</span>
                      <span className="budgeted">of {formatCurrency(data.budgeted)} budgeted</span>
                    </div>
                    {data.transaction_count > 0 && (
                      <div className="transaction-count">
                        {data.transaction_count} transaction{data.transaction_count !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                </div>
                <div className="analysis-actions">
                  {budgetData.budgets.find((b) => b.category === category) && (
                    <>
                      <button
                        className="btn-edit"
                        onClick={() => handleEdit(budgetData.budgets.find((b) => b.category === category))}
                        disabled={loading}
                        title="Edit budget"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => handleDelete(budgetData.budgets.find((b) => b.category === category).id)}
                        disabled={loading}
                        title="Delete budget"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Budget