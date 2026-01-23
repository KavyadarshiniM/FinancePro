// routes/expense.js - Expense management routes
const express = require("express")
const router = express.Router()

// Get all expense transactions for a specific user
router.get("/expense/:userId", (req, res) => {
  const userId = Number.parseInt(req.params.userId)
  const db = req.app.locals.db

  // Validate userId
  if (!userId || isNaN(userId) || userId <= 0) {
    return res.status(400).json({
      success: false,
      error: "Invalid user ID. Must be a positive integer.",
    })
  }

  console.log(`Fetching expense transactions for user ID: ${userId}`)

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

    const currentMonth = new Date().getMonth() + 1
    const currentYear = new Date().getFullYear()

    // Get month and year from query params or use current
    const month = Number.parseInt(req.query.month) || currentMonth
    const year = Number.parseInt(req.query.year) || currentYear

    const page = Number.parseInt(req.query.page) || 1
    const limit = Number.parseInt(req.query.limit) || 20
    const offset = (page - 1) * limit

    // Query for expense transactions with pagination and monthly filtering
    const expenseQuery = `
            SELECT id, category, amount, date, notes, created_at, updated_at
            FROM transactions 
            WHERE user_id = ? AND type = 'expense'
            AND MONTH(date) = ? AND YEAR(date) = ?
            ORDER BY date DESC, created_at DESC 
            LIMIT ? OFFSET ?
        `

    const countQuery = `
            SELECT COUNT(*) as total 
            FROM transactions 
            WHERE user_id = ? AND type = 'expense'
            AND MONTH(date) = ? AND YEAR(date) = ?
        `

    // Get total count with monthly filter
    db.query(countQuery, [userId, month, year], (err, countResult) => {
      if (err) {
        console.error(`Count query error for user ${userId}:`, err)
        return res.status(500).json({
          success: false,
          error: "Database error",
        })
      }

      const totalExpenses = countResult[0].total

      // Get expense transactions with monthly filter
      db.query(expenseQuery, [userId, month, year, limit, offset], (err, expenseResult) => {
        if (err) {
          console.error(`Expense query error for user ${userId}:`, err)
          return res.status(500).json({
            success: false,
            error: "Database error",
          })
        }

        console.log(`Retrieved ${expenseResult.length} expense transactions for user ${userId} for ${month}/${year}`)

        res.json({
          success: true,
          data: {
            userId: userId,
            userName: userCheck[0].name,
            expenseTransactions: expenseResult,
            month: month,
            year: year,
            pagination: {
              currentPage: page,
              totalPages: Math.ceil(totalExpenses / limit),
              totalTransactions: totalExpenses,
              limit: limit,
            },
          },
        })
      })
    })
  })
})

// Get user's current balance before adding expense
const getCurrentBalance = async (db, userId) => {
  return new Promise((resolve, reject) => {
    const balanceQuery = `SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income, COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses FROM transactions WHERE user_id = ?`

    db.query(balanceQuery, [userId], (err, result) => {
      if (err) {
        reject(err)
      } else {
        const balance = result[0].total_income - result[0].total_expenses
        resolve(balance)
      }
    })
  })
}

// Add a new expense transaction with balance validation
router.post("/expense", async (req, res) => {
  const { user_id, category, amount, date, notes } = req.body
  const db = req.app.locals.db

  // Enhanced validation
  if (!user_id || !category || !amount || !date) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: user_id, category, amount, date",
    })
  }

  const userId = Number.parseInt(user_id)
  if (!userId || isNaN(userId) || userId <= 0) {
    return res.status(400).json({
      success: false,
      error: "Invalid user_id. Must be a positive integer.",
    })
  }

  const expenseAmount = Number.parseFloat(amount)
  if (isNaN(expenseAmount) || expenseAmount <= 0) {
    return res.status(400).json({
      success: false,
      error: "Amount must be a positive number",
    })
  }

  // First verify user exists
  db.query("SELECT id FROM users WHERE id = ?", [userId], async (err, userCheck) => {
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

    try {
      // Check current balance
      const currentBalance = await getCurrentBalance(db, userId)

      if (expenseAmount > currentBalance) {
        return res.status(400).json({
          success: false,
          error: `Insufficient balance. Current balance: â‚¹${currentBalance.toFixed(2)}, Expense amount: â‚¹${expenseAmount.toFixed(2)}`,
        })
      }

      const insertQuery = `INSERT INTO transactions (user_id, type, category, amount, date, notes, created_at) VALUES (?, 'expense', ?, ?, ?, ?, NOW())`

      db.query(insertQuery, [userId, category, expenseAmount, date, notes || null], (err, result) => {
        if (err) {
          console.error(`Insert expense transaction error for user ${userId}:`, err)
          return res.status(500).json({
            success: false,
            error: "Failed to add expense transaction",
          })
        }

        console.log(`Expense transaction added successfully for user ${userId}:`, {
          id: result.insertId,
          category,
          amount: expenseAmount,
        })

        res.status(201).json({
          success: true,
          message: "Expense transaction added successfully",
          data: {
            id: result.insertId,
            user_id: userId,
            type: "expense",
            category: category,
            amount: expenseAmount,
            date: date,
            notes: notes,
            remainingBalance: currentBalance - expenseAmount,
          },
        })
      })
    } catch (error) {
      console.error("Balance check error:", error)
      return res.status(500).json({
        success: false,
        error: "Failed to verify balance",
      })
    }
  })
})

// Update an expense transaction with balance validation
router.put("/expense/:transactionId", async (req, res) => {
  const transactionId = Number.parseInt(req.params.transactionId)
  const { category, amount, date, notes, user_id } = req.body
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

  // Check if transaction exists, belongs to user, and is expense type
  const checkQuery = 'SELECT user_id, amount FROM transactions WHERE id = ? AND user_id = ? AND type = "expense"'

  db.query(checkQuery, [transactionId, userId], async (err, checkResult) => {
    if (err) {
      console.error("Check expense transaction error:", err)
      return res.status(500).json({
        success: false,
        error: "Database error",
      })
    }

    if (checkResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Expense transaction not found or does not belong to this user",
      })
    }

    const oldAmount = Number.parseFloat(checkResult[0].amount)

    // Validation for amount if being updated
    if (amount && (isNaN(amount) || Number.parseFloat(amount) <= 0)) {
      return res.status(400).json({
        success: false,
        error: "Amount must be a positive number",
      })
    }

    try {
      // If amount is being changed, check balance
      if (amount && Number.parseFloat(amount) !== oldAmount) {
        const newAmount = Number.parseFloat(amount)
        const currentBalance = await getCurrentBalance(db, userId)
        const balanceAfterRevert = currentBalance + oldAmount // Add back old expense

        if (newAmount > balanceAfterRevert) {
          return res.status(400).json({
            success: false,
            error: `Insufficient balance. Available balance: â‚¹${balanceAfterRevert.toFixed(2)}, New expense amount: â‚¹${newAmount.toFixed(2)}`,
          })
        }
      }

      // Build update query dynamically
      const updates = []
      const values = []

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

      const updateQuery = `UPDATE transactions SET ${updates.join(", ")} WHERE id = ? AND user_id = ? AND type = 'expense'`

      db.query(updateQuery, values, (err, result) => {
        if (err) {
          console.error("Update expense transaction error:", err)
          return res.status(500).json({
            success: false,
            error: "Failed to update expense transaction",
          })
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({
            success: false,
            error: "Expense transaction not found or no changes made",
          })
        }

        console.log(`Expense transaction ${transactionId} updated successfully for user ${userId}`)

        res.json({
          success: true,
          message: "Expense transaction updated successfully",
        })
      })
    } catch (error) {
      console.error("Balance validation error:", error)
      return res.status(500).json({
        success: false,
        error: "Failed to validate balance",
      })
    }
  })
})

// Delete an expense transaction
router.delete("/expense/:transactionId", (req, res) => {
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

  // Check if transaction exists, belongs to user, and is expense type
  const checkQuery = 'SELECT user_id FROM transactions WHERE id = ? AND user_id = ? AND type = "expense"'

  db.query(checkQuery, [transactionId, userId], (err, checkResult) => {
    if (err) {
      console.error("Check expense transaction error:", err)
      return res.status(500).json({
        success: false,
        error: "Database error",
      })
    }

    if (checkResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Expense transaction not found or does not belong to this user",
      })
    }

    const deleteQuery = 'DELETE FROM transactions WHERE id = ? AND user_id = ? AND type = "expense"'

    db.query(deleteQuery, [transactionId, userId], (err, result) => {
      if (err) {
        console.error("Delete expense transaction error:", err)
        return res.status(500).json({
          success: false,
          error: "Failed to delete expense transaction",
        })
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          error: "Expense transaction not found",
        })
      }

      console.log(`Expense transaction ${transactionId} deleted successfully for user ${userId}`)

      res.json({
        success: true,
        message: "Expense transaction deleted successfully",
      })
    })
  })
})

// Get expense summary for a specific user with month/year filtering
router.get("/expense-summary/:userId", (req, res) => {
  const userId = Number.parseInt(req.params.userId)
  const db = req.app.locals.db

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

    const currentMonth = new Date().getMonth() + 1
    const currentYear = new Date().getFullYear()

    // Get month and year from query params or use current
    const month = Number.parseInt(req.query.month) || currentMonth
    const year = Number.parseInt(req.query.year) || currentYear

    console.log(`Fetching expense summary for user ${userId}, month ${month}, year ${year}`)

    // Get current balance (always total, not filtered by month)
    const balanceQuery = `SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income, COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses FROM transactions WHERE user_id = ?`

    // Get total expenses for specified month/year
    const monthlyExpenseQuery = `SELECT COALESCE(SUM(amount), 0) as monthly_total FROM transactions WHERE user_id = ? AND type = 'expense' AND MONTH(date) = ? AND YEAR(date) = ?`

    // Get total expenses for specified year
    const yearlyExpenseQuery = `SELECT COALESCE(SUM(amount), 0) as yearly_total FROM transactions WHERE user_id = ? AND type = 'expense' AND YEAR(date) = ?`

    // Get expenses by category for specified month/year
    const categoryExpenseQuery = `SELECT category, SUM(amount) as total, COUNT(*) as count FROM transactions WHERE user_id = ? AND type = 'expense' AND MONTH(date) = ? AND YEAR(date) = ? GROUP BY category HAVING total > 0 ORDER BY total DESC`

    // Execute queries
    let completedQueries = 0
    const totalQueries = 4
    const results = {}
    let hasError = false

    const checkComplete = () => {
      completedQueries++
      if (completedQueries === totalQueries && !hasError) {
        const currentBalance = results.balance.total_income - results.balance.total_expenses

        res.json({
          success: true,
          data: {
            userId: userId,
            userName: userCheck[0].name,
            monthlyTotal: Number.parseFloat(results.monthly?.monthly_total) || 0,
            yearlyTotal: Number.parseFloat(results.yearly?.yearly_total) || 0,
            expensesByCategory: results.categories || [],
            currentBalance: Math.max(0, currentBalance), // Ensure positive balance
            month: month,
            year: year,
          },
        })
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

    // Balance query (total balance, not filtered)
    db.query(balanceQuery, [userId], (err, balanceResult) => {
      if (err) return handleError(err, "balance query")
      results.balance = balanceResult[0]
      checkComplete()
    })

    // Monthly expenses (filtered by month/year)
    db.query(monthlyExpenseQuery, [userId, month, year], (err, monthlyResult) => {
      if (err) return handleError(err, "monthly expense query")
      results.monthly = monthlyResult[0]
      checkComplete()
    })

    // Yearly expenses (filtered by year)
    db.query(yearlyExpenseQuery, [userId, year], (err, yearlyResult) => {
      if (err) return handleError(err, "yearly expense query")
      results.yearly = yearlyResult[0]
      checkComplete()
    })

    // Category breakdown (filtered by month/year)
    db.query(categoryExpenseQuery, [userId, month, year], (err, categoryResult) => {
      if (err) return handleError(err, "category expense query")
      results.categories = categoryResult
      checkComplete()
    })
  })
})

module.exports = router