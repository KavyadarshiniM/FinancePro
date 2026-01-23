// routes/budget.js - Budget management routes
const express = require("express")
const router = express.Router()

// Get all budgets for a specific user
router.get("/budget/:userId", (req, res) => {
  const userId = Number.parseInt(req.params.userId)
  const db = req.app.locals.db

  // Validate userId
  if (!userId || isNaN(userId) || userId <= 0) {
    return res.status(400).json({
      success: false,
      error: "Invalid user ID. Must be a positive integer.",
    })
  }

  console.log(`Fetching budgets for user ID: ${userId}`)

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

    // Query for budgets with pagination
    const budgetQuery = `
            SELECT id, category, monthly_limit, month, year, created_at, updated_at
            FROM budgets 
            WHERE user_id = ? AND month = ? AND year = ?
            ORDER BY category ASC
        `

    db.query(budgetQuery, [userId, month, year], (err, budgetResult) => {
      if (err) {
        console.error(`Budget query error for user ${userId}:`, err)
        return res.status(500).json({
          success: false,
          error: "Database error",
        })
      }

      console.log(`Retrieved ${budgetResult.length} budgets for user ${userId}`)

      res.json({
        success: true,
        data: {
          userId: userId,
          userName: userCheck[0].name,
          budgets: budgetResult,
          month: month,
          year: year,
        },
      })
    })
  })
})

// Add a new budget
router.post("/budget", (req, res) => {
  const { user_id, category, monthly_limit, month, year } = req.body
  const db = req.app.locals.db

  // Enhanced validation
  if (!user_id || !category || !monthly_limit) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: user_id, category, monthly_limit",
    })
  }

  const userId = Number.parseInt(user_id)
  if (!userId || isNaN(userId) || userId <= 0) {
    return res.status(400).json({
      success: false,
      error: "Invalid user_id. Must be a positive integer.",
    })
  }

  const budgetLimit = Number.parseFloat(monthly_limit)
  if (isNaN(budgetLimit) || budgetLimit <= 0) {
    return res.status(400).json({
      success: false,
      error: "Monthly limit must be a positive number",
    })
  }

  const budgetMonth = Number.parseInt(month) || new Date().getMonth() + 1
  const budgetYear = Number.parseInt(year) || new Date().getFullYear()

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

    // Check if budget already exists for this category, month, and year
    const checkQuery = `
            SELECT id FROM budgets 
            WHERE user_id = ? AND category = ? AND month = ? AND year = ?
        `

    db.query(checkQuery, [userId, category, budgetMonth, budgetYear], (err, existingBudget) => {
      if (err) {
        console.error("Budget check error:", err)
        return res.status(500).json({ success: false, error: "Database error" })
      }

      if (existingBudget.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Budget for category '${category}' already exists for ${budgetMonth}/${budgetYear}`,
        })
      }

      const insertQuery = `
                INSERT INTO budgets (user_id, category, monthly_limit, month, year, created_at) 
                VALUES (?, ?, ?, ?, ?, NOW())
            `

      db.query(insertQuery, [userId, category, budgetLimit, budgetMonth, budgetYear], (err, result) => {
        if (err) {
          console.error(`Insert budget error for user ${userId}:`, err)
          return res.status(500).json({
            success: false,
            error: "Failed to add budget",
          })
        }

        console.log(`Budget added successfully for user ${userId}:`, {
          id: result.insertId,
          category,
          monthly_limit: budgetLimit,
        })

        res.status(201).json({
          success: true,
          message: "Budget added successfully",
          data: {
            id: result.insertId,
            user_id: userId,
            category: category,
            monthly_limit: budgetLimit,
            month: budgetMonth,
            year: budgetYear,
          },
        })
      })
    })
  })
})

// Update a budget
router.put("/budget/:budgetId", (req, res) => {
  const budgetId = Number.parseInt(req.params.budgetId)
  const { category, monthly_limit, user_id } = req.body
  const db = req.app.locals.db

  if (!budgetId || isNaN(budgetId) || budgetId <= 0) {
    return res.status(400).json({
      success: false,
      error: "Invalid budget ID",
    })
  }

  const userId = Number.parseInt(user_id)
  if (!userId || isNaN(userId) || userId <= 0) {
    return res.status(400).json({
      success: false,
      error: "Invalid user_id",
    })
  }

  // Check if budget exists and belongs to user
  const checkQuery = "SELECT user_id, category, month, year FROM budgets WHERE id = ? AND user_id = ?"

  db.query(checkQuery, [budgetId, userId], (err, checkResult) => {
    if (err) {
      console.error("Check budget error:", err)
      return res.status(500).json({
        success: false,
        error: "Database error",
      })
    }

    if (checkResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Budget not found or does not belong to this user",
      })
    }

    // Validation for monthly_limit if being updated
    if (monthly_limit && (isNaN(monthly_limit) || Number.parseFloat(monthly_limit) <= 0)) {
      return res.status(400).json({
        success: false,
        error: "Monthly limit must be a positive number",
      })
    }

    // If category is being changed, check for duplicates
    if (category && category !== checkResult[0].category) {
      const duplicateQuery = `
                SELECT id FROM budgets 
                WHERE user_id = ? AND category = ? AND month = ? AND year = ? AND id != ?
            `

      db.query(
        duplicateQuery,
        [userId, category, checkResult[0].month, checkResult[0].year, budgetId],
        (err, duplicateResult) => {
          if (err) {
            console.error("Duplicate check error:", err)
            return res.status(500).json({ success: false, error: "Database error" })
          }

          if (duplicateResult.length > 0) {
            return res.status(400).json({
              success: false,
              error: `Budget for category '${category}' already exists for this month/year`,
            })
          }

          updateBudget()
        },
      )
    } else {
      updateBudget()
    }

    function updateBudget() {
      // Build update query dynamically
      const updates = []
      const values = []

      if (category) {
        updates.push("category = ?")
        values.push(category)
      }
      if (monthly_limit) {
        updates.push("monthly_limit = ?")
        values.push(Number.parseFloat(monthly_limit))
      }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          error: "No fields to update",
        })
      }

      updates.push("updated_at = NOW()")
      values.push(budgetId, userId)

      const updateQuery = `UPDATE budgets SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`

      db.query(updateQuery, values, (err, result) => {
        if (err) {
          console.error("Update budget error:", err)
          return res.status(500).json({
            success: false,
            error: "Failed to update budget",
          })
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({
            success: false,
            error: "Budget not found or no changes made",
          })
        }

        console.log(`Budget ${budgetId} updated successfully for user ${userId}`)

        res.json({
          success: true,
          message: "Budget updated successfully",
        })
      })
    }
  })
})

// Delete a budget
router.delete("/budget/:budgetId", (req, res) => {
  const budgetId = Number.parseInt(req.params.budgetId)
  const userId = Number.parseInt(req.query.user_id)
  const db = req.app.locals.db

  if (!budgetId || isNaN(budgetId) || budgetId <= 0) {
    return res.status(400).json({
      success: false,
      error: "Invalid budget ID",
    })
  }

  if (!userId || isNaN(userId) || userId <= 0) {
    return res.status(400).json({
      success: false,
      error: "Valid user_id is required",
    })
  }

  // Check if budget exists and belongs to user
  const checkQuery = "SELECT user_id FROM budgets WHERE id = ? AND user_id = ?"

  db.query(checkQuery, [budgetId, userId], (err, checkResult) => {
    if (err) {
      console.error("Check budget error:", err)
      return res.status(500).json({
        success: false,
        error: "Database error",
      })
    }

    if (checkResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Budget not found or does not belong to this user",
      })
    }

    const deleteQuery = "DELETE FROM budgets WHERE id = ? AND user_id = ?"

    db.query(deleteQuery, [budgetId, userId], (err, result) => {
      if (err) {
        console.error("Delete budget error:", err)
        return res.status(500).json({
          success: false,
          error: "Failed to delete budget",
        })
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          error: "Budget not found",
        })
      }

      console.log(`Budget ${budgetId} deleted successfully for user ${userId}`)

      res.json({
        success: true,
        message: "Budget deleted successfully",
      })
    })
  })
})

// Get budget vs expense analysis for a specific user
router.get("/budget-analysis/:userId", (req, res) => {
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

    // Get budgets for the specified month/year
    const budgetQuery = `
            SELECT category, monthly_limit
            FROM budgets 
            WHERE user_id = ? AND month = ? AND year = ?
        `

    // Get actual expenses for the specified month/year
    const expenseQuery = `
            SELECT category, SUM(amount) as total_spent, COUNT(*) as transaction_count
            FROM transactions 
            WHERE user_id = ? AND type = 'expense' 
            AND MONTH(date) = ? AND YEAR(date) = ?
            GROUP BY category
        `

    // Execute queries
    let completedQueries = 0
    const totalQueries = 2
    const results = {}
    let hasError = false

    const checkComplete = () => {
      completedQueries++
      if (completedQueries === totalQueries && !hasError) {
        // Process the data to create budget vs expense analysis
        const budgetMap = {}
        results.budgets.forEach((budget) => {
          budgetMap[budget.category] = {
            budgeted: Number.parseFloat(budget.monthly_limit),
            spent: 0,
            remaining: Number.parseFloat(budget.monthly_limit),
            percentage: 0,
            status: "under",
            transaction_count: 0,
          }
        })

        // Add expense data
        results.expenses.forEach((expense) => {
          const category = expense.category
          const spent = Number.parseFloat(expense.total_spent)

          if (budgetMap[category]) {
            budgetMap[category].spent = spent
            budgetMap[category].remaining = budgetMap[category].budgeted - spent
            budgetMap[category].percentage = (spent / budgetMap[category].budgeted) * 100
            budgetMap[category].transaction_count = Number.parseInt(expense.transaction_count)

            if (spent > budgetMap[category].budgeted) {
              budgetMap[category].status = "over"
            } else if (spent >= budgetMap[category].budgeted * 0.8) {
              budgetMap[category].status = "warning"
            } else {
              budgetMap[category].status = "under"
            }
          } else {
            // Expense without budget
            budgetMap[category] = {
              budgeted: 0,
              spent: spent,
              remaining: -spent,
              percentage: 0,
              status: "no_budget",
              transaction_count: Number.parseInt(expense.transaction_count),
            }
          }
        })

        // Calculate totals
        let totalBudgeted = 0
        let totalSpent = 0
        let categoriesOverBudget = 0
        let categoriesUnderBudget = 0

        Object.values(budgetMap).forEach((item) => {
          totalBudgeted += item.budgeted
          totalSpent += item.spent
          if (item.status === "over") categoriesOverBudget++
          if (item.status === "under" && item.budgeted > 0) categoriesUnderBudget++
        })

        res.json({
          success: true,
          data: {
            userId: userId,
            userName: userCheck[0].name,
            month: month,
            year: year,
            summary: {
              totalBudgeted: totalBudgeted,
              totalSpent: totalSpent,
              totalRemaining: totalBudgeted - totalSpent,
              overallPercentage: totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0,
              categoriesOverBudget: categoriesOverBudget,
              categoriesUnderBudget: categoriesUnderBudget,
              totalCategories: Object.keys(budgetMap).length,
            },
            categoryAnalysis: budgetMap,
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

    // Budget query
    db.query(budgetQuery, [userId, month, year], (err, budgetResult) => {
      if (err) return handleError(err, "budget query")
      results.budgets = budgetResult
      checkComplete()
    })

    // Expense query
    db.query(expenseQuery, [userId, month, year], (err, expenseResult) => {
      if (err) return handleError(err, "expense query")
      results.expenses = expenseResult
      checkComplete()
    })
  })
})

// Get budget summary for dashboard
router.get("/budget-summary/:userId", (req, res) => {
  const userId = Number.parseInt(req.params.userId)
  const db = req.app.locals.db

  if (!userId || isNaN(userId) || userId <= 0) {
    return res.status(400).json({
      success: false,
      error: "Invalid user ID",
    })
  }

  const currentMonth = new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()

  // Get total budgets for current month
  const budgetSummaryQuery = `
        SELECT 
            COUNT(*) as total_budgets,
            COALESCE(SUM(monthly_limit), 0) as total_budget_amount
        FROM budgets 
        WHERE user_id = ? AND month = ? AND year = ?
    `

  db.query(budgetSummaryQuery, [userId, currentMonth, currentYear], (err, result) => {
    if (err) {
      console.error("Budget summary error:", err)
      return res.status(500).json({ success: false, error: "Database error" })
    }

    res.json({
      success: true,
      data: {
        userId: userId,
        month: currentMonth,
        year: currentYear,
        totalBudgets: Number.parseInt(result[0].total_budgets),
        totalBudgetAmount: Number.parseFloat(result[0].total_budget_amount) || 0,
      },
    })
  })
})

module.exports = router
