// routes/dashboard.js - Dashboard routes with month/year or date range filtering
const express = require("express")
const router = express.Router()

// Get dashboard data for a specific user with month/year or date range filtering
router.get("/dashboard/:userId", (req, res) => {
  const userId = Number.parseInt(req.params.userId)
  const db = req.app.locals.db

  // Validate userId more strictly
  if (!userId || isNaN(userId) || userId <= 0) {
    return res.status(400).json({
      success: false,
      error: "Invalid user ID. Must be a positive integer.",
    })
  }

  console.log(`Fetching dashboard data for user ID: ${userId}`)

  let dateCondition = ""
  let dateParams = []

  if (req.query.startDate && req.query.endDate) {
    // Date range filtering
    dateCondition = "AND date >= ? AND date <= ?"
    dateParams = [req.query.startDate, req.query.endDate]
    console.log(`Using date range: ${req.query.startDate} to ${req.query.endDate}`)
  } else {
    // Month/year filtering (existing logic)
    const currentMonth = new Date().getMonth() + 1
    const currentYear = new Date().getFullYear()
    const month = Number.parseInt(req.query.month) || currentMonth
    const year = Number.parseInt(req.query.year) || currentYear
    dateCondition = "AND MONTH(date) = ? AND YEAR(date) = ?"
    dateParams = [month, year]
    console.log(`Using month/year: ${month}/${year}`)
  }

  // First, check if user exists and get user info
  const userCheckQuery = "SELECT id, name, email FROM users WHERE id = ?"

  db.query(userCheckQuery, [userId], (err, userResults) => {
    if (err) {
      console.error("User check error:", err)
      return res.status(500).json({
        success: false,
        error: "Database error during user verification",
      })
    }

    if (userResults.length === 0) {
      return res.status(404).json({
        success: false,
        error: `User with ID ${userId} not found`,
      })
    }

    const userData = userResults[0]
    console.log(`Found user: ${userData.name} (ID: ${userData.id})`)

    // Get total income for the specified period
    const incomeQuery = `
            SELECT COALESCE(SUM(amount), 0) as total_income 
            FROM transactions 
            WHERE user_id = ? AND type = 'income' 
            ${dateCondition}
        `

    // Get total expenses for the specified period
    const expenseQuery = `
            SELECT COALESCE(SUM(amount), 0) as total_expenses 
            FROM transactions 
            WHERE user_id = ? AND type = 'expense' 
            ${dateCondition}
        `

    // Get recent transactions for the specified period (last 10)
    const recentQuery = `
            SELECT id, type, category, amount, date, notes, created_at
            FROM transactions 
            WHERE user_id = ? 
            ${dateCondition}
            ORDER BY date DESC, created_at DESC 
            LIMIT 10
        `

    // Get expenses by category for the specified period
    const categoryQuery = `
            SELECT category, SUM(amount) as total 
            FROM transactions 
            WHERE user_id = ? AND type = 'expense' 
            ${dateCondition}
            GROUP BY category 
            HAVING total > 0
            ORDER BY total DESC
        `

    let budgetQuery
    let budgetParams

    if (req.query.startDate && req.query.endDate) {
      // For date ranges, get all budgets and calculate spending within the range
      budgetQuery = `
                SELECT 
                    b.id,
                    b.category, 
                    b.monthly_limit,
                    COALESCE(SUM(t.amount), 0) as spent
                FROM budgets b
                LEFT JOIN transactions t ON b.category = t.category 
                    AND t.user_id = b.user_id 
                    AND t.type = 'expense'
                    AND t.date >= ? AND t.date <= ?
                WHERE b.user_id = ?
                GROUP BY b.id, b.category, b.monthly_limit
            `
      budgetParams = [req.query.startDate, req.query.endDate, userId]
    } else {
      // For month/year, use existing logic
      const month = Number.parseInt(req.query.month) || new Date().getMonth() + 1
      const year = Number.parseInt(req.query.year) || new Date().getFullYear()
      budgetQuery = `
                SELECT 
                    b.id,
                    b.category, 
                    b.monthly_limit,
                    COALESCE(SUM(t.amount), 0) as spent
                FROM budgets b
                LEFT JOIN transactions t ON b.category = t.category 
                    AND t.user_id = b.user_id 
                    AND t.type = 'expense'
                    AND MONTH(t.date) = ? AND YEAR(t.date) = ?
                WHERE b.user_id = ? AND b.month = ? AND b.year = ?
                GROUP BY b.id, b.category, b.monthly_limit
            `
      budgetParams = [month, year, userId, month, year]
    }

    // Execute all queries using Promise.all equivalent with callbacks
    let completedQueries = 0
    const totalQueries = 5
    const results = {}
    let hasError = false

    const checkComplete = () => {
      completedQueries++
      if (completedQueries === totalQueries && !hasError) {
        const totalIncome = Number.parseFloat(results.income?.total_income) || 0
        const totalExpenses = Number.parseFloat(results.expenses?.total_expenses) || 0
        const balance = totalIncome - totalExpenses

        // Process budget data
        const budgets = results.budgets.map((budget) => ({
          ...budget,
          spent: Number.parseFloat(budget.spent) || 0,
          monthly_limit: Number.parseFloat(budget.monthly_limit) || 0,
        }))

        const responseData = {
          success: true,
          data: {
            user: userData,
            totalIncome: totalIncome,
            totalExpenses: totalExpenses,
            balance: balance,
            recentTransactions: results.recent || [],
            expensesByCategory: results.categories || [],
            budgets: budgets,
            filterType: req.query.startDate && req.query.endDate ? "dateRange" : "monthYear",
            filterInfo:
              req.query.startDate && req.query.endDate
                ? { startDate: req.query.startDate, endDate: req.query.endDate }
                : {
                    month: Number.parseInt(req.query.month) || new Date().getMonth() + 1,
                    year: Number.parseInt(req.query.year) || new Date().getFullYear(),
                  },
          },
        }

        console.log(`Dashboard data for user ${userId}:`, {
          user: userData.name,
          income: totalIncome,
          expenses: totalExpenses,
          balance: balance,
          transactionsCount: results.recent.length,
          categoriesCount: results.categories.length,
          budgetsCount: budgets.length,
          filterType: responseData.data.filterType,
        })

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

    // Execute income query
    db.query(incomeQuery, [userId, ...dateParams], (err, incomeResult) => {
      if (err) return handleError(err, "income query")
      results.income = incomeResult[0]
      console.log(`Income result for user ${userId}:`, results.income)
      checkComplete()
    })

    // Execute expense query
    db.query(expenseQuery, [userId, ...dateParams], (err, expenseResult) => {
      if (err) return handleError(err, "expense query")
      results.expenses = expenseResult[0]
      console.log(`Expenses result for user ${userId}:`, results.expenses)
      checkComplete()
    })

    // Execute recent transactions query
    db.query(recentQuery, [userId, ...dateParams], (err, recentResult) => {
      if (err) return handleError(err, "recent transactions query")
      results.recent = recentResult
      console.log(`Recent transactions for user ${userId}:`, recentResult.length)
      checkComplete()
    })

    // Execute category breakdown query
    db.query(categoryQuery, [userId, ...dateParams], (err, categoryResult) => {
      if (err) return handleError(err, "category breakdown query")
      results.categories = categoryResult
      console.log(`Categories for user ${userId}:`, categoryResult.length)
      checkComplete()
    })

    // Execute budget query
    db.query(budgetQuery, budgetParams, (err, budgetResult) => {
      if (err) return handleError(err, "budget query")
      results.budgets = budgetResult || []
      console.log(`Budgets for user ${userId}:`, budgetResult.length)
      checkComplete()
    })
  })
})

// Get all transactions for a SPECIFIC user with optional month/year filtering
router.get("/transactions/:userId", (req, res) => {
  const userId = Number.parseInt(req.params.userId)
  const db = req.app.locals.db

  if (!userId || isNaN(userId) || userId <= 0) {
    return res.status(400).json({
      success: false,
      error: "Invalid user ID. Must be a positive integer.",
    })
  }

  // First verify user exists
  db.query("SELECT id FROM users WHERE id = ?", [userId], (err, userCheck) => {
    if (err) {
      console.error("User verification error:", err)
      return res.status(500).json({ success: false, error: "Database error" })
    }

    if (userCheck.length === 0) {
      return res.status(404).json({
        success: false,
        error: `User with ID ${userId} not found`,
      })
    }

    const page = Number.parseInt(req.query.page) || 1
    const limit = Number.parseInt(req.query.limit) || 20
    const offset = (page - 1) * limit

    // Get month and year from query params if provided
    const month = req.query.month ? Number.parseInt(req.query.month) : null
    const year = req.query.year ? Number.parseInt(req.query.year) : null

    // Build query based on whether month/year filtering is requested
    let transactionsQuery = `SELECT id, type, category, amount, date, notes, created_at FROM transactions WHERE user_id = ?`
    let countQuery = `SELECT COUNT(*) as total FROM transactions WHERE user_id = ?`
    const queryParams = [userId]
    const countParams = [userId]

    if (month && year) {
      transactionsQuery += ` AND MONTH(date) = ? AND YEAR(date) = ?`
      countQuery += ` AND MONTH(date) = ? AND YEAR(date) = ?`
      queryParams.push(month, year)
      countParams.push(month, year)
    }

    transactionsQuery += ` ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?`
    queryParams.push(limit, offset)

    db.query(countQuery, countParams, (err, countResult) => {
      if (err) {
        console.error(`Count query error for user ${userId}:`, err)
        return res.status(500).json({
          success: false,
          error: "Database error",
        })
      }

      const totalTransactions = countResult[0].total

      db.query(transactionsQuery, queryParams, (err, transactionsResult) => {
        if (err) {
          console.error(`Transactions query error for user ${userId}:`, err)
          return res.status(500).json({
            success: false,
            error: "Database error",
          })
        }

        console.log(
          `Retrieved ${transactionsResult.length} transactions for user ${userId}` +
            (month && year ? ` (${month}/${year})` : ""),
        )

        res.json({
          success: true,
          data: {
            userId: userId,
            transactions: transactionsResult,
            pagination: {
              currentPage: page,
              totalPages: Math.ceil(totalTransactions / limit),
              totalTransactions: totalTransactions,
              limit: limit,
            },
            filters: {
              month: month,
              year: year,
            },
          },
        })
      })
    })
  })
})

// Add a new transaction (with enhanced user validation)
router.post("/transactions", (req, res) => {
  const { user_id, type, category, amount, date, notes } = req.body
  const db = req.app.locals.db

  // Enhanced validation
  if (!user_id || !type || !category || !amount || !date) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: user_id, type, category, amount, date",
    })
  }

  const userId = Number.parseInt(user_id)
  if (!userId || isNaN(userId) || userId <= 0) {
    return res.status(400).json({
      success: false,
      error: "Invalid user_id. Must be a positive integer.",
    })
  }

  if (!["income", "expense"].includes(type)) {
    return res.status(400).json({
      success: false,
      error: 'Type must be either "income" or "expense"',
    })
  }

  if (isNaN(amount) || Number.parseFloat(amount) <= 0) {
    return res.status(400).json({
      success: false,
      error: "Amount must be a positive number",
    })
  }

  // First verify user exists
  db.query("SELECT id FROM users WHERE id = ?", [userId], (err, userCheck) => {
    if (err) {
      console.error("User verification error:", err)
      return res.status(500).json({ success: false, error: "Database error" })
    }

    if (userCheck.length === 0) {
      return res.status(404).json({
        success: false,
        error: `User with ID ${userId} not found`,
      })
    }

    const insertQuery = `INSERT INTO transactions (user_id, type, category, amount, date, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())`

    db.query(insertQuery, [userId, type, category, Number.parseFloat(amount), date, notes || null], (err, result) => {
      if (err) {
        console.error(`Insert transaction error for user ${userId}:`, err)
        return res.status(500).json({
          success: false,
          error: "Failed to add transaction",
        })
      }

      console.log(`Transaction added successfully for user ${userId}:`, {
        id: result.insertId,
        type,
        category,
        amount: Number.parseFloat(amount),
      })

      res.status(201).json({
        success: true,
        message: "Transaction added successfully",
        data: {
          id: result.insertId,
          user_id: userId,
          type: type,
          category: category,
          amount: Number.parseFloat(amount),
          date: date,
          notes: notes,
        },
      })
    })
  })
})

// Update a transaction (enhanced security)
router.put("/transactions/:transactionId", (req, res) => {
  const transactionId = Number.parseInt(req.params.transactionId)
  const { type, category, amount, date, notes, user_id } = req.body
  const db = req.app.locals.db

  if (!transactionId || isNaN(transactionId) || transactionId <= 0) {
    return res.status(400).json({
      success: false,
      error: "Invalid transaction ID",
    })
  }

  const userId = Number.parseInt(user_id)
  if (!userId || isNaN(userId) || userId <= 0) {
    return res.status(400).json({
      success: false,
      error: "Invalid user_id",
    })
  }

  // Check if transaction exists and belongs to the specific user
  const checkQuery = "SELECT user_id FROM transactions WHERE id = ? AND user_id = ?"

  db.query(checkQuery, [transactionId, userId], (err, checkResult) => {
    if (err) {
      console.error("Check transaction error:", err)
      return res.status(500).json({
        success: false,
        error: "Database error",
      })
    }

    if (checkResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Transaction not found or does not belong to this user",
      })
    }

    // Validation
    if (type && !["income", "expense"].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Type must be either "income" or "expense"',
      })
    }

    if (amount && (isNaN(amount) || Number.parseFloat(amount) <= 0)) {
      return res.status(400).json({
        success: false,
        error: "Amount must be a positive number",
      })
    }

    // Build update query dynamically
    const updates = []
    const values = []

    if (type) {
      updates.push("type = ?")
      values.push(type)
    }
    if (category) {
      updates.push("category = ?")
      values.push(category)
    }
    if (amount) {
      updates.push("amount = ?")
      values.push(Number.parseFloat(amount))
    }
    if (date) {
      updates.push("date = ?")
      values.push(date)
    }
    if (notes !== undefined) {
      updates.push("notes = ?")
      values.push(notes)
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No fields to update",
      })
    }

    updates.push("updated_at = NOW()")
    values.push(transactionId, userId)

    const updateQuery = `UPDATE transactions SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`

    db.query(updateQuery, values, (err, result) => {
      if (err) {
        console.error("Update transaction error:", err)
        return res.status(500).json({
          success: false,
          error: "Failed to update transaction",
        })
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          error: "Transaction not found or no changes made",
        })
      }

      console.log(`Transaction ${transactionId} updated successfully for user ${userId}`)

      res.json({
        success: true,
        message: "Transaction updated successfully",
      })
    })
  })
})

// Delete a transaction (enhanced security)
router.delete("/transactions/:transactionId", (req, res) => {
  const transactionId = Number.parseInt(req.params.transactionId)
  const userId = Number.parseInt(req.query.user_id)
  const db = req.app.locals.db

  if (!transactionId || isNaN(transactionId) || transactionId <= 0) {
    return res.status(400).json({
      success: false,
      error: "Invalid transaction ID",
    })
  }

  if (!userId || isNaN(userId) || userId <= 0) {
    return res.status(400).json({
      success: false,
      error: "Valid user_id is required",
    })
  }

  // Check if transaction exists and belongs to the specific user
  const checkQuery = "SELECT user_id FROM transactions WHERE id = ? AND user_id = ?"

  db.query(checkQuery, [transactionId, userId], (err, checkResult) => {
    if (err) {
      console.error("Check transaction error:", err)
      return res.status(500).json({
        success: false,
        error: "Database error",
      })
    }

    if (checkResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Transaction not found or does not belong to this user",
      })
    }

    const deleteQuery = "DELETE FROM transactions WHERE id = ? AND user_id = ?"

    db.query(deleteQuery, [transactionId, userId], (err, result) => {
      if (err) {
        console.error("Delete transaction error:", err)
        return res.status(500).json({
          success: false,
          error: "Failed to delete transaction",
        })
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          error: "Transaction not found",
        })
      }

      console.log(`Transaction ${transactionId} deleted successfully for user ${userId}`)

      res.json({
        success: true,
        message: "Transaction deleted successfully",
      })
    })
  })
})

// Get user info (specific user only)
router.get("/user/:userId", (req, res) => {
  const userId = Number.parseInt(req.params.userId)
  const db = req.app.locals.db

  if (!userId || isNaN(userId) || userId <= 0) {
    return res.status(400).json({
      success: false,
      error: "Invalid user ID",
    })
  }

  db.query("SELECT id, name, email, created_at FROM users WHERE id = ?", [userId], (err, results) => {
    if (err) {
      console.error(`Get user error for user ${userId}:`, err)
      return res.status(500).json({
        success: false,
        error: "Database error",
      })
    }

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        error: `User with ID ${userId} not found`,
      })
    }

    console.log(`User info retrieved for user ${userId}: ${results[0].name}`)

    res.json({
      success: true,
      user: results[0],
    })
  })
})

// Get spending summary by month (specific user only) - Enhanced with date range support
router.get("/summary/:userId", (req, res) => {
  const userId = Number.parseInt(req.params.userId)
  const db = req.app.locals.db
  const months = Number.parseInt(req.query.months) || 6

  if (!userId || isNaN(userId) || userId <= 0) {
    return res.status(400).json({
      success: false,
      error: "Invalid user ID",
    })
  }

  // First verify user exists
  db.query("SELECT id, name FROM users WHERE id = ?", [userId], (err, userCheck) => {
    if (err) {
      console.error("User verification error:", err)
      return res.status(500).json({ success: false, error: "Database error" })
    }

    if (userCheck.length === 0) {
      return res.status(404).json({
        success: false,
        error: `User with ID ${userId} not found`,
      })
    }

    let summaryQuery
    let queryParams

    if (req.query.startDate && req.query.endDate) {
      // Date range summary
      summaryQuery = `
                SELECT 
                    YEAR(date) as year,
                    MONTH(date) as month,
                    DATE_FORMAT(date, '%M') as month_name,
                    type,
                    COALESCE(SUM(amount), 0) as total
                FROM transactions 
                WHERE user_id = ? 
                AND date >= ? AND date <= ?
                GROUP BY YEAR(date), MONTH(date), DATE_FORMAT(date, '%M'), type
                ORDER BY year DESC, month DESC
            `
      queryParams = [userId, req.query.startDate, req.query.endDate]
    } else {
      // Monthly summary (existing logic)
      summaryQuery = `
                SELECT 
                    YEAR(date) as year,
                    MONTH(date) as month,
                    DATE_FORMAT(date, '%M') as month_name,
                    type,
                    COALESCE(SUM(amount), 0) as total
                FROM transactions 
                WHERE user_id = ? 
                AND date >= DATE_SUB(CURDATE(), INTERVAL ${months} MONTH)
                GROUP BY YEAR(date), MONTH(date), DATE_FORMAT(date, '%M'), type
                ORDER BY year DESC, month DESC
            `
      queryParams = [userId]
    }

    console.log("Executing summary query for user:", userId)

    db.query(summaryQuery, queryParams, (err, results) => {
      if (err) {
        console.error(`Summary query error for user ${userId}:`, err)
        return res.status(500).json({
          success: false,
          error: "Database error",
        })
      }

      // Process results to create a structured summary
      const summary = {}

      results.forEach((row) => {
        const key = `${row.year}-${row.month}`
        if (!summary[key]) {
          summary[key] = {
            year: row.year,
            month: row.month,
            month_name: row.month_name,
            income: 0,
            expense: 0,
            balance: 0,
          }
        }
        summary[key][row.type] = Number.parseFloat(row.total)
      })

      // Calculate balance for each month
      Object.keys(summary).forEach((key) => {
        summary[key].balance = summary[key].income - summary[key].expense
      })

      console.log(
        `Summary retrieved for user ${userId} (${userCheck[0].name}):`,
        Object.keys(summary).length,
        "periods",
      )

      res.json({
        success: true,
        data: {
          userId: userId,
          userName: userCheck[0].name,
          summary: Object.values(summary),
          filterType: req.query.startDate && req.query.endDate ? "dateRange" : "monthly",
          months: months,
        },
      })
    })
  })
})

module.exports = router
