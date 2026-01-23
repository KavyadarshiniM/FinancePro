// routes/reports.js - Comprehensive Reports routes for detailed financial analysis
const express = require("express")
const router = express.Router()

// Get Financial Summary Report for a specific user
router.get("/financial-summary/:userId", (req, res) => {
  const userId = parseInt(req.params.userId)
  const db = req.app.locals.db

  // Validate userId
  if (!userId || isNaN(userId) || userId <= 0) {
    return res.status(400).json({
      success: false,
      error: "Invalid user ID. Must be a positive integer.",
    })
  }

  console.log(`Fetching financial summary report for user ID: ${userId}`)

  let dateCondition = ""
  let dateParams = []

  if (req.query.startDate && req.query.endDate) {
    dateCondition = "AND date >= ? AND date <= ?"
    dateParams = [req.query.startDate, req.query.endDate]
    console.log(`Using date range: ${req.query.startDate} to ${req.query.endDate}`)
  } else {
    const currentMonth = new Date().getMonth() + 1
    const currentYear = new Date().getFullYear()
    const month = parseInt(req.query.month) || currentMonth
    const year = parseInt(req.query.year) || currentYear
    dateCondition = "AND MONTH(date) = ? AND YEAR(date) = ?"
    dateParams = [month, year]
    console.log(`Using month/year: ${month}/${year}`)
  }

  // First verify user exists
  db.query("SELECT id, name, email FROM users WHERE id = ?", [userId], (err, userResults) => {
    if (err) {
      console.error("User verification error:", err)
      return res.status(500).json({ success: false, error: "Database error" })
    }

    if (userResults.length === 0) {
      return res.status(404).json({
        success: false,
        error: `User with ID ${userId} not found`,
      })
    }

    const userData = userResults[0]

    // Get comprehensive financial data
    const queries = {
      // Total income and expenses
      totals: `
        SELECT 
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expenses,
          COUNT(CASE WHEN type = 'income' THEN 1 END) as income_transactions,
          COUNT(CASE WHEN type = 'expense' THEN 1 END) as expense_transactions
        FROM transactions 
        WHERE user_id = ? ${dateCondition}
      `,

      // Monthly breakdown
      monthlyBreakdown: `
        SELECT 
          YEAR(date) as year,
          MONTH(date) as month,
          MONTHNAME(date) as month_name,
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as monthly_income,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as monthly_expenses
        FROM transactions 
        WHERE user_id = ? ${dateCondition}
        GROUP BY YEAR(date), MONTH(date), MONTHNAME(date)
        ORDER BY year DESC, month DESC
      `,

      // Category breakdown
      categoryBreakdown: `
        SELECT 
          category,
          type,
          SUM(amount) as total,
          COUNT(*) as transaction_count,
          AVG(amount) as average_amount
        FROM transactions 
        WHERE user_id = ? ${dateCondition}
        GROUP BY category, type
        ORDER BY total DESC
      `,

      // Daily spending patterns
      dailyPattern: `
        SELECT 
          DAYNAME(date) as day_name,
          DAYOFWEEK(date) as day_number,
          AVG(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as avg_daily_expense,
          COUNT(CASE WHEN type = 'expense' THEN 1 END) as expense_count
        FROM transactions 
        WHERE user_id = ? ${dateCondition}
        GROUP BY DAYNAME(date), DAYOFWEEK(date)
        ORDER BY day_number
      `
    }

    let completedQueries = 0
    const totalQueries = Object.keys(queries).length
    const results = {}
    let hasError = false

    const checkComplete = () => {
      completedQueries++
      if (completedQueries === totalQueries && !hasError) {
        const totalIncome = parseFloat(results.totals?.total_income) || 0
        const totalExpenses = parseFloat(results.totals?.total_expenses) || 0
        const balance = totalIncome - totalExpenses

        // Calculate additional metrics
        const savingsRate = totalIncome > 0 ? ((balance / totalIncome) * 100) : 0
        const avgMonthlyIncome = results.monthlyBreakdown.length > 0 ? 
          results.monthlyBreakdown.reduce((sum, month) => sum + parseFloat(month.monthly_income), 0) / results.monthlyBreakdown.length : 0
        const avgMonthlyExpenses = results.monthlyBreakdown.length > 0 ? 
          results.monthlyBreakdown.reduce((sum, month) => sum + parseFloat(month.monthly_expenses), 0) / results.monthlyBreakdown.length : 0

        const responseData = {
          success: true,
          data: {
            user: userData,
            summary: {
              totalIncome,
              totalExpenses,
              balance,
              savingsRate: parseFloat(savingsRate.toFixed(2)),
              incomeTransactions: results.totals?.income_transactions || 0,
              expenseTransactions: results.totals?.expense_transactions || 0,
              avgMonthlyIncome: parseFloat(avgMonthlyIncome.toFixed(2)),
              avgMonthlyExpenses: parseFloat(avgMonthlyExpenses.toFixed(2))
            },
            monthlyBreakdown: results.monthlyBreakdown.map(month => ({
              ...month,
              monthly_income: parseFloat(month.monthly_income),
              monthly_expenses: parseFloat(month.monthly_expenses),
              balance: parseFloat(month.monthly_income) - parseFloat(month.monthly_expenses)
            })),
            categoryBreakdown: results.categoryBreakdown.map(cat => ({
              ...cat,
              total: parseFloat(cat.total),
              average_amount: parseFloat(cat.average_amount)
            })),
            dailyPattern: results.dailyPattern.map(day => ({
              ...day,
              avg_daily_expense: parseFloat(day.avg_daily_expense)
            })),
            filterInfo: req.query.startDate && req.query.endDate ? 
              { startDate: req.query.startDate, endDate: req.query.endDate, type: "dateRange" } :
              { month: parseInt(req.query.month) || new Date().getMonth() + 1, year: parseInt(req.query.year) || new Date().getFullYear(), type: "monthYear" }
          }
        }

        console.log(`Financial summary report generated for user ${userId}`)
        res.json(responseData)
      }
    }

    const handleError = (error, queryName) => {
      if (!hasError) {
        hasError = true
        console.error(`${queryName} error for user ${userId}:`, error)
        res.status(500).json({
          success: false,
          error: `Database error in ${queryName}`,
        })
      }
    }

    // Execute all queries
    Object.entries(queries).forEach(([queryName, query]) => {
      db.query(query, [userId, ...dateParams], (err, result) => {
        if (err) return handleError(err, queryName)
        results[queryName] = queryName === 'totals' ? result[0] : result
        checkComplete()
      })
    })
  })
})

// Get Category Analysis Report
router.get("/category-analysis/:userId", (req, res) => {
  const userId = parseInt(req.params.userId)
  const db = req.app.locals.db

  if (!userId || isNaN(userId) || userId <= 0) {
    return res.status(400).json({
      success: false,
      error: "Invalid user ID. Must be a positive integer.",
    })
  }

  let dateCondition = ""
  let dateParams = []

  if (req.query.startDate && req.query.endDate) {
    dateCondition = "AND date >= ? AND date <= ?"
    dateParams = [req.query.startDate, req.query.endDate]
  } else {
    const currentMonth = new Date().getMonth() + 1
    const currentYear = new Date().getFullYear()
    const month = parseInt(req.query.month) || currentMonth
    const year = parseInt(req.query.year) || currentYear
    dateCondition = "AND MONTH(date) = ? AND YEAR(date) = ?"
    dateParams = [month, year]
  }

  // First verify user exists
  db.query("SELECT id, name FROM users WHERE id = ?", [userId], (err, userResults) => {
    if (err) {
      console.error("User verification error:", err)
      return res.status(500).json({ success: false, error: "Database error" })
    }

    if (userResults.length === 0) {
      return res.status(404).json({
        success: false,
        error: `User with ID ${userId} not found`,
      })
    }

    const queries = {
      // Category spending with trends
      categorySpending: `
        SELECT 
          category,
          type,
          SUM(amount) as total_amount,
          COUNT(*) as transaction_count,
          AVG(amount) as avg_amount,
          MIN(amount) as min_amount,
          MAX(amount) as max_amount,
          MIN(date) as first_transaction,
          MAX(date) as last_transaction
        FROM transactions 
        WHERE user_id = ? ${dateCondition}
        GROUP BY category, type
        ORDER BY total_amount DESC
      `,

      // Monthly category trends - FIXED VERSION
      monthlyTrends: `
        SELECT 
          category,
          YEAR(date) as year,
          MONTH(date) as month,
          MONTHNAME(date) as month_name,
          SUM(amount) as monthly_total,
          COUNT(*) as monthly_count
        FROM transactions 
        WHERE user_id = ? AND type = 'expense' ${dateCondition}
        GROUP BY category, YEAR(date), MONTH(date), MONTHNAME(date)
        ORDER BY category, year DESC, month DESC
      `,

      // Top spending categories
      topCategories: `
        SELECT 
          category,
          SUM(amount) as total_spent,
          COUNT(*) as transactions,
          (SUM(amount) / (SELECT SUM(amount) FROM transactions WHERE user_id = ? AND type = 'expense' ${dateCondition}) * 100) as percentage_of_total
        FROM transactions 
        WHERE user_id = ? AND type = 'expense' ${dateCondition}
        GROUP BY category
        ORDER BY total_spent DESC
        LIMIT 10
      `
    }

    let completedQueries = 0
    const totalQueries = Object.keys(queries).length
    const results = {}
    let hasError = false

    const checkComplete = () => {
      completedQueries++
      if (completedQueries === totalQueries && !hasError) {
        const responseData = {
          success: true,
          data: {
            user: userResults[0],
            categorySpending: results.categorySpending.map(cat => ({
              ...cat,
              total_amount: parseFloat(cat.total_amount),
              avg_amount: parseFloat(cat.avg_amount),
              min_amount: parseFloat(cat.min_amount),
              max_amount: parseFloat(cat.max_amount)
            })),
            monthlyTrends: results.monthlyTrends.map(trend => ({
              ...trend,
              monthly_total: parseFloat(trend.monthly_total)
            })),
            topCategories: results.topCategories.map(cat => ({
              ...cat,
              total_spent: parseFloat(cat.total_spent),
              percentage_of_total: parseFloat(cat.percentage_of_total)
            })),
            filterInfo: req.query.startDate && req.query.endDate ? 
              { startDate: req.query.startDate, endDate: req.query.endDate, type: "dateRange" } :
              { month: parseInt(req.query.month) || new Date().getMonth() + 1, year: parseInt(req.query.year) || new Date().getFullYear(), type: "monthYear" }
          }
        }

        console.log(`Category analysis report generated for user ${userId}`)
        res.json(responseData)
      }
    }

    const handleError = (error, queryName) => {
      if (!hasError) {
        hasError = true
        console.error(`${queryName} error for user ${userId}:`, error)
        res.status(500).json({
          success: false,
          error: `Database error in ${queryName}`,
        })
      }
    }

    // Execute category spending query
    db.query(queries.categorySpending, [userId, ...dateParams], (err, result) => {
      if (err) return handleError(err, 'categorySpending')
      results.categorySpending = result
      checkComplete()
    })

    // Execute monthly trends query
    db.query(queries.monthlyTrends, [userId, ...dateParams], (err, result) => {
      if (err) return handleError(err, 'monthlyTrends')
      results.monthlyTrends = result
      checkComplete()
    })

    // Execute top categories query (needs special parameter handling)
    db.query(queries.topCategories, [userId, ...dateParams, userId, ...dateParams], (err, result) => {
      if (err) return handleError(err, 'topCategories')
      results.topCategories = result
      checkComplete()
    })
  })
})

// Get Budget Performance Report
router.get("/budget-performance/:userId", (req, res) => {
  const userId = parseInt(req.params.userId)
  const db = req.app.locals.db

  if (!userId || isNaN(userId) || userId <= 0) {
    return res.status(400).json({
      success: false,
      error: "Invalid user ID. Must be a positive integer.",
    })
  }

  const currentMonth = new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()
  const month = parseInt(req.query.month) || currentMonth
  const year = parseInt(req.query.year) || currentYear

  console.log(`Fetching budget performance report for user ${userId}, ${month}/${year}`)

  // First verify user exists
  db.query("SELECT id, name FROM users WHERE id = ?", [userId], (err, userResults) => {
    if (err) {
      console.error("User verification error:", err)
      return res.status(500).json({ success: false, error: "Database error" })
    }

    if (userResults.length === 0) {
      return res.status(404).json({
        success: false,
        error: `User with ID ${userId} not found`,
      })
    }

    const queries = {
      // Budget vs actual spending
      budgetVsActual: `
        SELECT 
          b.id,
          b.category,
          b.monthly_limit,
          b.month,
          b.year,
          COALESCE(SUM(t.amount), 0) as actual_spent,
          (COALESCE(SUM(t.amount), 0) / b.monthly_limit * 100) as usage_percentage,
          (b.monthly_limit - COALESCE(SUM(t.amount), 0)) as remaining,
          COUNT(t.id) as transaction_count
        FROM budgets b
        LEFT JOIN transactions t ON b.category = t.category 
          AND t.user_id = b.user_id 
          AND t.type = 'expense'
          AND MONTH(t.date) = b.month 
          AND YEAR(t.date) = b.year
        WHERE b.user_id = ? AND b.month = ? AND b.year = ?
        GROUP BY b.id, b.category, b.monthly_limit, b.month, b.year
        ORDER BY usage_percentage DESC
      `,

      // Historical budget performance (last 6 months)
      historicalPerformance: `
        SELECT 
          b.category,
          b.month,
          b.year,
          b.monthly_limit,
          COALESCE(SUM(t.amount), 0) as actual_spent,
          (COALESCE(SUM(t.amount), 0) / b.monthly_limit * 100) as usage_percentage
        FROM budgets b
        LEFT JOIN transactions t ON b.category = t.category 
          AND t.user_id = b.user_id 
          AND t.type = 'expense'
          AND MONTH(t.date) = b.month 
          AND YEAR(t.date) = b.year
        WHERE b.user_id = ? 
          AND ((b.year = ? AND b.month <= ?) OR (b.year < ?))
          AND b.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
        GROUP BY b.category, b.month, b.year, b.monthly_limit
        ORDER BY b.year DESC, b.month DESC, b.category
      `,

      // Budget summary statistics
      budgetSummary: `
        SELECT 
          COUNT(*) as total_budgets,
          SUM(b.monthly_limit) as total_budgeted,
          SUM(COALESCE(spent.amount, 0)) as total_spent,
          AVG(CASE WHEN b.monthly_limit > 0 THEN (COALESCE(spent.amount, 0) / b.monthly_limit * 100) ELSE 0 END) as avg_usage_percentage
        FROM budgets b
        LEFT JOIN (
          SELECT category, SUM(amount) as amount
          FROM transactions 
          WHERE user_id = ? AND type = 'expense' 
            AND MONTH(date) = ? AND YEAR(date) = ?
          GROUP BY category
        ) spent ON b.category = spent.category
        WHERE b.user_id = ? AND b.month = ? AND b.year = ?
      `
    }

    let completedQueries = 0
    const totalQueries = Object.keys(queries).length
    const results = {}
    let hasError = false

    const checkComplete = () => {
      completedQueries++
      if (completedQueries === totalQueries && !hasError) {
        const responseData = {
          success: true,
          data: {
            user: userResults[0],
            currentPeriod: { month, year },
            budgetVsActual: results.budgetVsActual.map(budget => ({
              ...budget,
              monthly_limit: parseFloat(budget.monthly_limit),
              actual_spent: parseFloat(budget.actual_spent),
              usage_percentage: parseFloat(budget.usage_percentage),
              remaining: parseFloat(budget.remaining)
            })),
            historicalPerformance: results.historicalPerformance.map(perf => ({
              ...perf,
              monthly_limit: parseFloat(perf.monthly_limit),
              actual_spent: parseFloat(perf.actual_spent),
              usage_percentage: parseFloat(perf.usage_percentage)
            })),
            summary: {
              ...results.budgetSummary,
              total_budgeted: parseFloat(results.budgetSummary?.total_budgeted) || 0,
              total_spent: parseFloat(results.budgetSummary?.total_spent) || 0,
              avg_usage_percentage: parseFloat(results.budgetSummary?.avg_usage_percentage) || 0
            }
          }
        }

        console.log(`Budget performance report generated for user ${userId}`)
        res.json(responseData)
      }
    }

    const handleError = (error, queryName) => {
      if (!hasError) {
        hasError = true
        console.error(`${queryName} error for user ${userId}:`, error)
        res.status(500).json({
          success: false,
          error: `Database error in ${queryName}`,
        })
      }
    }

    // Execute budget vs actual query
    db.query(queries.budgetVsActual, [userId, month, year], (err, result) => {
      if (err) return handleError(err, 'budgetVsActual')
      results.budgetVsActual = result
      checkComplete()
    })

    // Execute historical performance query
    db.query(queries.historicalPerformance, [userId, year, month, year], (err, result) => {
      if (err) return handleError(err, 'historicalPerformance')
      results.historicalPerformance = result
      checkComplete()
    })

    // Execute budget summary query
    db.query(queries.budgetSummary, [userId, month, year, userId, month, year], (err, result) => {
      if (err) return handleError(err, 'budgetSummary')
      results.budgetSummary = result[0] || {}
      checkComplete()
    })
  })
})

// Get Cash Flow Report
router.get("/cash-flow/:userId", (req, res) => {
  const userId = parseInt(req.params.userId)
  const db = req.app.locals.db

  if (!userId || isNaN(userId) || userId <= 0) {
    return res.status(400).json({
      success: false,
      error: "Invalid user ID. Must be a positive integer.",
    })
  }

  let dateCondition = ""
  let dateParams = []
  const months = parseInt(req.query.months) || 12

  if (req.query.startDate && req.query.endDate) {
    dateCondition = "AND date >= ? AND date <= ?"
    dateParams = [req.query.startDate, req.query.endDate]
  } else {
    dateCondition = `AND date >= DATE_SUB(NOW(), INTERVAL ${months} MONTH)`
  }

  console.log(`Fetching cash flow report for user ${userId}`)

  // First verify user exists
  db.query("SELECT id, name FROM users WHERE id = ?", [userId], (err, userResults) => {
    if (err) {
      console.error("User verification error:", err)
      return res.status(500).json({ success: false, error: "Database error" })
    }

    if (userResults.length === 0) {
      return res.status(404).json({
        success: false,
        error: `User with ID ${userId} not found`,
      })
    }

    const queries = {
      // Monthly cash flow
      monthlyCashFlow: `
        SELECT 
          YEAR(date) as year,
          MONTH(date) as month,
          MONTHNAME(date) as month_name,
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses,
          (SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) - 
           SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END)) as net_cash_flow
        FROM transactions 
        WHERE user_id = ? ${dateCondition}
        GROUP BY YEAR(date), MONTH(date), MONTHNAME(date)
        ORDER BY year DESC, month DESC
      `,

      // Weekly cash flow for recent period
      weeklyCashFlow: `
        SELECT 
          YEARWEEK(date) as year_week,
          WEEK(date) as week_number,
          MIN(date) as week_start,
          MAX(date) as week_end,
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as weekly_income,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as weekly_expenses,
          (SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) - 
           SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END)) as weekly_net_flow
        FROM transactions 
        WHERE user_id = ? AND date >= DATE_SUB(NOW(), INTERVAL 8 WEEK)
        GROUP BY YEARWEEK(date), WEEK(date)
        ORDER BY year_week DESC
      `,

      // Cash flow summary
      cashFlowSummary: `
        SELECT 
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expenses,
          (SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) - 
           SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END)) as net_cash_flow,
          COUNT(CASE WHEN type = 'income' THEN 1 END) as income_transactions,
          COUNT(CASE WHEN type = 'expense' THEN 1 END) as expense_transactions
        FROM transactions 
        WHERE user_id = ? ${dateCondition}
      `
    }

    let completedQueries = 0
    const totalQueries = Object.keys(queries).length
    const results = {}
    let hasError = false

    const checkComplete = () => {
      completedQueries++
      if (completedQueries === totalQueries && !hasError) {
        const responseData = {
          success: true,
          data: {
            user: userResults[0],
            monthlyCashFlow: results.monthlyCashFlow.map(month => ({
              ...month,
              income: parseFloat(month.income),
              expenses: parseFloat(month.expenses),
              net_cash_flow: parseFloat(month.net_cash_flow)
            })),
            weeklyCashFlow: results.weeklyCashFlow.map(week => ({
              ...week,
              weekly_income: parseFloat(week.weekly_income),
              weekly_expenses: parseFloat(week.weekly_expenses),
              weekly_net_flow: parseFloat(week.weekly_net_flow)
            })),
            summary: {
              ...results.cashFlowSummary,
              total_income: parseFloat(results.cashFlowSummary?.total_income) || 0,
              total_expenses: parseFloat(results.cashFlowSummary?.total_expenses) || 0,
              net_cash_flow: parseFloat(results.cashFlowSummary?.net_cash_flow) || 0
            },
            filterInfo: req.query.startDate && req.query.endDate ? 
              { startDate: req.query.startDate, endDate: req.query.endDate, type: "dateRange" } :
              { months, type: "months" }
          }
        }

        console.log(`Cash flow report generated for user ${userId}`)
        res.json(responseData)
      }
    }

    const handleError = (error, queryName) => {
      if (!hasError) {
        hasError = true
        console.error(`${queryName} error for user ${userId}:`, error)
        res.status(500).json({
          success: false,
          error: `Database error in ${queryName}`,
        })
      }
    }

    // Execute monthly cash flow query
    db.query(queries.monthlyCashFlow, [userId, ...dateParams], (err, result) => {
      if (err) return handleError(err, 'monthlyCashFlow')
      results.monthlyCashFlow = result
      checkComplete()
    })

    // Execute weekly cash flow query
    db.query(queries.weeklyCashFlow, [userId], (err, result) => {
      if (err) return handleError(err, 'weeklyCashFlow')
      results.weeklyCashFlow = result
      checkComplete()
    })

    // Execute cash flow summary query
    db.query(queries.cashFlowSummary, [userId, ...dateParams], (err, result) => {
      if (err) return handleError(err, 'cashFlowSummary')
      results.cashFlowSummary = result[0] || {}
      checkComplete()
    })
  })
})

// Get Trend Analysis Report
router.get("/trend-analysis/:userId", (req, res) => {
  const userId = parseInt(req.params.userId)
  const db = req.app.locals.db

  if (!userId || isNaN(userId) || userId <= 0) {
    return res.status(400).json({
      success: false,
      error: "Invalid user ID. Must be a positive integer.",
    })
  }

  const months = parseInt(req.query.months) || 12
  console.log(`Fetching trend analysis report for user ${userId} (${months} months)`)

  // First verify user exists
  db.query("SELECT id, name FROM users WHERE id = ?", [userId], (err, userResults) => {
    if (err) {
      console.error("User verification error:", err)
      return res.status(500).json({ success: false, error: "Database error" })
    }

    if (userResults.length === 0) {
      return res.status(404).json({
        success: false,
        error: `User with ID ${userId} not found`,
      })
    }

    const queries = {
      // Monthly trends with growth rates - FIXED VERSION
      monthlyTrends: `
        SELECT 
          YEAR(date) as year,
          MONTH(date) as month,
          MONTHNAME(date) as month_name,
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as monthly_income,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as monthly_expenses,
          (SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) - 
           SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END)) as monthly_balance
        FROM transactions 
        WHERE user_id = ? AND date >= DATE_SUB(NOW(), INTERVAL ? MONTH)
        GROUP BY YEAR(date), MONTH(date), MONTHNAME(date)
        ORDER BY year, month
      `,

      // Category trends - FIXED VERSION
      categoryTrends: `
        SELECT 
          category,
          YEAR(date) as year,
          MONTH(date) as month,
          SUM(amount) as monthly_total
        FROM transactions 
        WHERE user_id = ? AND type = 'expense' 
          AND date >= DATE_SUB(NOW(), INTERVAL ? MONTH)
        GROUP BY category, YEAR(date), MONTH(date)
        ORDER BY category, year, month
      `,


      // Year over year comparison
      yearOverYear: `
        SELECT 
          YEAR(date) as year,
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as yearly_income,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as yearly_expenses,
          (SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) - 
           SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END)) as yearly_balance
        FROM transactions 
        WHERE user_id = ? AND date >= DATE_SUB(NOW(), INTERVAL ? MONTH)
        GROUP BY YEAR(date)
        ORDER BY year
      `
    }

    let completedQueries = 0
    const totalQueries = Object.keys(queries).length
    const results = {}
    let hasError = false

    const checkComplete = () => {
      completedQueries++
      if (completedQueries === totalQueries && !hasError) {
        // Calculate growth rates for monthly trends
        const monthlyTrendsWithGrowth = results.monthlyTrends.map((month, index) => {
          const prevMonth = index > 0 ? results.monthlyTrends[index - 1] : null
          const incomeGrowth = prevMonth && prevMonth.monthly_income > 0 ? 
            ((parseFloat(month.monthly_income) - parseFloat(prevMonth.monthly_income)) / parseFloat(prevMonth.monthly_income) * 100) : 0
          const expenseGrowth = prevMonth && prevMonth.monthly_expenses > 0 ? 
            ((parseFloat(month.monthly_expenses) - parseFloat(prevMonth.monthly_expenses)) / parseFloat(prevMonth.monthly_expenses) * 100) : 0

          return {
            ...month,
            monthly_income: parseFloat(month.monthly_income),
            monthly_expenses: parseFloat(month.monthly_expenses),
            monthly_balance: parseFloat(month.monthly_balance),
            income_growth_rate: parseFloat(incomeGrowth.toFixed(2)),
            expense_growth_rate: parseFloat(expenseGrowth.toFixed(2))
          }
        })

        const responseData = {
          success: true,
          data: {
            user: userResults[0],
            monthlyTrends: monthlyTrendsWithGrowth,
            categoryTrends: results.categoryTrends.map(trend => ({
              ...trend,
              monthly_total: parseFloat(trend.monthly_total)
            })),
            yearOverYear: results.yearOverYear.map(year => ({
              ...year,
              yearly_income: parseFloat(year.yearly_income),
              yearly_expenses: parseFloat(year.yearly_expenses),
              yearly_balance: parseFloat(year.yearly_balance)
            })),
            filterInfo: { months, type: "months" }
          }
        }

        console.log(`Trend analysis report generated for user ${userId}`)
        res.json(responseData)
      }
    }

    const handleError = (error, queryName) => {
      if (!hasError) {
        hasError = true
        console.error(`${queryName} error for user ${userId}:`, error)
        res.status(500).json({
          success: false,
          error: `Database error in ${queryName}`,
        })
      }
    }

    // Execute monthly trends query
    db.query(queries.monthlyTrends, [userId, months], (err, result) => {
      if (err) return handleError(err, 'monthlyTrends')
      results.monthlyTrends = result
      checkComplete()
    })

    // Execute category trends query
    db.query(queries.categoryTrends, [userId, months], (err, result) => {
      if (err) return handleError(err, 'categoryTrends')
      results.categoryTrends = result
      checkComplete()
    })

    // Execute year over year query
    db.query(queries.yearOverYear, [userId, months], (err, result) => {
      if (err) return handleError(err, 'yearOverYear')
      results.yearOverYear = result
      checkComplete()
    })
  })
})

// Get Comparison Report (Month to Month, Year to Year)
router.get("/comparison/:userId", (req, res) => {
  const userId = parseInt(req.params.userId)
  const db = req.app.locals.db

  if (!userId || isNaN(userId) || userId <= 0) {
    return res.status(400).json({
      success: false,
      error: "Invalid user ID. Must be a positive integer.",
    })
  }

  // Get comparison parameters
  const currentMonth = parseInt(req.query.currentMonth) || new Date().getMonth() + 1
  const currentYear = parseInt(req.query.currentYear) || new Date().getFullYear()
  const compareMonth = parseInt(req.query.compareMonth) || (currentMonth === 1 ? 12 : currentMonth - 1)
  const compareYear = parseInt(req.query.compareYear) || (currentMonth === 1 ? currentYear - 1 : currentYear)

  console.log(`Fetching comparison report for user ${userId}: ${currentMonth}/${currentYear} vs ${compareMonth}/${compareYear}`)

  // First verify user exists
  db.query("SELECT id, name FROM users WHERE id = ?", [userId], (err, userResults) => {
    if (err) {
      console.error("User verification error:", err)
      return res.status(500).json({ success: false, error: "Database error" })
    }

    if (userResults.length === 0) {
      return res.status(404).json({
        success: false,
        error: `User with ID ${userId} not found`,
      })
    }

    const queries = {
      // Current period data
      currentPeriod: `
        SELECT 
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses,
          COUNT(CASE WHEN type = 'income' THEN 1 END) as income_count,
          COUNT(CASE WHEN type = 'expense' THEN 1 END) as expense_count
        FROM transactions 
        WHERE user_id = ? AND MONTH(date) = ? AND YEAR(date) = ?
      `,

      // Comparison period data
      comparisonPeriod: `
        SELECT 
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses,
          COUNT(CASE WHEN type = 'income' THEN 1 END) as income_count,
          COUNT(CASE WHEN type = 'expense' THEN 1 END) as expense_count
        FROM transactions 
        WHERE user_id = ? AND MONTH(date) = ? AND YEAR(date) = ?
      `,

      // Category comparison
      currentCategories: `
        SELECT 
          category,
          type,
          SUM(amount) as total,
          COUNT(*) as count
        FROM transactions 
        WHERE user_id = ? AND MONTH(date) = ? AND YEAR(date) = ?
        GROUP BY category, type
        ORDER BY total DESC
      `,

      comparisonCategories: `
        SELECT 
          category,
          type,
          SUM(amount) as total,
          COUNT(*) as count
        FROM transactions 
        WHERE user_id = ? AND MONTH(date) = ? AND YEAR(date) = ?
        GROUP BY category, type
        ORDER BY total DESC
      `
    }

    let completedQueries = 0
    const totalQueries = Object.keys(queries).length
    const results = {}
    let hasError = false

    const checkComplete = () => {
      completedQueries++
      if (completedQueries === totalQueries && !hasError) {
        const current = results.currentPeriod || { income: 0, expenses: 0, income_count: 0, expense_count: 0 }
        const comparison = results.comparisonPeriod || { income: 0, expenses: 0, income_count: 0, expense_count: 0 }

        // Calculate percentage changes
        const incomeChange = comparison.income > 0 ? 
          ((parseFloat(current.income) - parseFloat(comparison.income)) / parseFloat(comparison.income) * 100) : 0
        const expenseChange = comparison.expenses > 0 ? 
          ((parseFloat(current.expenses) - parseFloat(comparison.expenses)) / parseFloat(comparison.expenses) * 100) : 0
        const balanceChange = (parseFloat(current.income) - parseFloat(current.expenses)) - 
                             (parseFloat(comparison.income) - parseFloat(comparison.expenses))

        // Merge category data for comparison
        const categoryComparison = {}
        
        // Process current categories
        results.currentCategories.forEach(cat => {
          if (!categoryComparison[cat.category]) {
            categoryComparison[cat.category] = { current: {}, comparison: {} }
          }
          categoryComparison[cat.category].current[cat.type] = {
            total: parseFloat(cat.total),
            count: cat.count
          }
        })

        // Process comparison categories
        results.comparisonCategories.forEach(cat => {
          if (!categoryComparison[cat.category]) {
            categoryComparison[cat.category] = { current: {}, comparison: {} }
          }
          categoryComparison[cat.category].comparison[cat.type] = {
            total: parseFloat(cat.total),
            count: cat.count
          }
        })

        // Calculate category changes
        Object.keys(categoryComparison).forEach(category => {
          const cat = categoryComparison[category]
          
          // For expenses
          if (cat.current.expense || cat.comparison.expense) {
            const currentExpense = cat.current.expense?.total || 0
            const comparisonExpense = cat.comparison.expense?.total || 0
            cat.expenseChange = comparisonExpense > 0 ? 
              ((currentExpense - comparisonExpense) / comparisonExpense * 100) : 0
            cat.expenseAbsoluteChange = currentExpense - comparisonExpense
          }

          // For income
          if (cat.current.income || cat.comparison.income) {
            const currentIncome = cat.current.income?.total || 0
            const comparisonIncome = cat.comparison.income?.total || 0
            cat.incomeChange = comparisonIncome > 0 ? 
              ((currentIncome - comparisonIncome) / comparisonIncome * 100) : 0
            cat.incomeAbsoluteChange = currentIncome - comparisonIncome
          }
        })

        const responseData = {
          success: true,
          data: {
            user: userResults[0],
            periods: {
              current: {
                month: currentMonth,
                year: currentYear,
                monthName: new Date(currentYear, currentMonth - 1).toLocaleString('default', { month: 'long' })
              },
              comparison: {
                month: compareMonth,
                year: compareYear,
                monthName: new Date(compareYear, compareMonth - 1).toLocaleString('default', { month: 'long' })
              }
            },
            summary: {
              current: {
                income: parseFloat(current.income) || 0,
                expenses: parseFloat(current.expenses) || 0,
                balance: (parseFloat(current.income) || 0) - (parseFloat(current.expenses) || 0),
                income_count: current.income_count || 0,
                expense_count: current.expense_count || 0
              },
              comparison: {
                income: parseFloat(comparison.income) || 0,
                expenses: parseFloat(comparison.expenses) || 0,
                balance: (parseFloat(comparison.income) || 0) - (parseFloat(comparison.expenses) || 0),
                income_count: comparison.income_count || 0,
                expense_count: comparison.expense_count || 0
              },
              changes: {
                income_change: parseFloat(incomeChange.toFixed(2)),
                expense_change: parseFloat(expenseChange.toFixed(2)),
                balance_change: parseFloat(balanceChange.toFixed(2)),
                income_absolute_change: (parseFloat(current.income) || 0) - (parseFloat(comparison.income) || 0),
                expense_absolute_change: (parseFloat(current.expenses) || 0) - (parseFloat(comparison.expenses) || 0)
              }
            },
            categoryComparison: Object.entries(categoryComparison).map(([category, data]) => ({
              category,
              ...data,
              expenseChange: parseFloat((data.expenseChange || 0).toFixed(2)),
              incomeChange: parseFloat((data.incomeChange || 0).toFixed(2)),
              expenseAbsoluteChange: parseFloat((data.expenseAbsoluteChange || 0).toFixed(2)),
              incomeAbsoluteChange: parseFloat((data.incomeAbsoluteChange || 0).toFixed(2))
            }))
          }
        }

        console.log(`Comparison report generated for user ${userId}`)
        res.json(responseData)
      }
    }

    const handleError = (error, queryName) => {
      if (!hasError) {
        hasError = true
        console.error(`${queryName} error for user ${userId}:`, error)
        res.status(500).json({
          success: false,
          error: `Database error in ${queryName}`,
        })
      }
    }

    // Execute current period query
    db.query(queries.currentPeriod, [userId, currentMonth, currentYear], (err, result) => {
      if (err) return handleError(err, 'currentPeriod')
      results.currentPeriod = result[0] || {}
      checkComplete()
    })

    // Execute comparison period query
    db.query(queries.comparisonPeriod, [userId, compareMonth, compareYear], (err, result) => {
      if (err) return handleError(err, 'comparisonPeriod')
      results.comparisonPeriod = result[0] || {}
      checkComplete()
    })

    // Execute current categories query
    db.query(queries.currentCategories, [userId, currentMonth, currentYear], (err, result) => {
      if (err) return handleError(err, 'currentCategories')
      results.currentCategories = result
      checkComplete()
    })

    // Execute comparison categories query
    db.query(queries.comparisonCategories, [userId, compareMonth, compareYear], (err, result) => {
      if (err) return handleError(err, 'comparisonCategories')
      results.comparisonCategories = result
      checkComplete()
    })
  })
})

// Test route for reports
router.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "Reports API is working!",
    timestamp: new Date().toISOString(),
    availableRoutes: [
      "GET /api/financial-summary/:userId",
      "GET /api/category-analysis/:userId", 
      "GET /api/budget-performance/:userId",
      "GET /api/cash-flow/:userId",
      "GET /api/trend-analysis/:userId",
      "GET /api/comparison/:userId"
    ]
  })
})

module.exports = router