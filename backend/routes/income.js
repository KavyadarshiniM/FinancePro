// routes/income.js - Income management routes with month/year filtering
const express = require('express');
const router = express.Router();

// Get all income transactions for a specific user with month/year filtering
router.get('/income/:userId', (req, res) => {
    const userId = parseInt(req.params.userId);
    const db = req.app.locals.db;
    
    // Validate userId
    if (!userId || isNaN(userId) || userId <= 0) {
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid user ID. Must be a positive integer.' 
        });
    }

    console.log(`Fetching income transactions for user ID: ${userId}`);

    // First verify user exists
    db.query('SELECT id, name FROM users WHERE id = ?', [userId], (err, userCheck) => {
        if (err) {
            console.error('User verification error:', err);
            return res.status(500).json({ success: false, error: 'Database error' });
        }

        if (userCheck.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: `User with ID ${userId} not found` 
            });
        }

        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        // Get month and year from query params or use current
        const month = parseInt(req.query.month) || currentMonth;
        const year = parseInt(req.query.year) || currentYear;

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        // Query for income transactions with pagination and monthly filtering
        const incomeQuery = `
            SELECT id, category, amount, date, notes, created_at, updated_at
            FROM transactions 
            WHERE user_id = ? AND type = 'income'
            AND MONTH(date) = ? AND YEAR(date) = ?
            ORDER BY date DESC, created_at DESC 
            LIMIT ? OFFSET ?
        `;

        const countQuery = `
            SELECT COUNT(*) as total 
            FROM transactions 
            WHERE user_id = ? AND type = 'income'
            AND MONTH(date) = ? AND YEAR(date) = ?
        `;

        // Get total count with monthly filter
        db.query(countQuery, [userId, month, year], (err, countResult) => {
            if (err) {
                console.error(`Count query error for user ${userId}:`, err);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Database error' 
                });
            }

            const totalIncome = countResult[0].total;

            // Get income transactions with monthly filter
            db.query(incomeQuery, [userId, month, year, limit, offset], (err, incomeResult) => {
                if (err) {
                    console.error(`Income query error for user ${userId}:`, err);
                    return res.status(500).json({ 
                        success: false, 
                        error: 'Database error' 
                    });
                }

                console.log(`Retrieved ${incomeResult.length} income transactions for user ${userId} for ${month}/${year}`);

                res.json({
                    success: true,
                    data: {
                        userId: userId,
                        userName: userCheck[0].name,
                        incomeTransactions: incomeResult,
                        month: month,
                        year: year,
                        pagination: {
                            currentPage: page,
                            totalPages: Math.ceil(totalIncome / limit),
                            totalTransactions: totalIncome,
                            limit: limit
                        }
                    }
                });
            });
        });
    });
});

// Add a new income transaction
router.post('/income', (req, res) => {
    const { user_id, category, amount, date, notes } = req.body;
    const db = req.app.locals.db;

    // Enhanced validation
    if (!user_id || !category || !amount || !date) {
        return res.status(400).json({ 
            success: false, 
            error: 'Missing required fields: user_id, category, amount, date' 
        });
    }

    const userId = parseInt(user_id);
    if (!userId || isNaN(userId) || userId <= 0) {
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid user_id. Must be a positive integer.' 
        });
    }

    if (isNaN(amount) || parseFloat(amount) <= 0) {
        return res.status(400).json({ 
            success: false, 
            error: 'Amount must be a positive number' 
        });
    }

    // First verify user exists
    db.query('SELECT id FROM users WHERE id = ?', [userId], (err, userCheck) => {
        if (err) {
            console.error('User verification error:', err);
            return res.status(500).json({ success: false, error: 'Database error' });
        }

        if (userCheck.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: `User with ID ${userId} not found` 
            });
        }

        const insertQuery = `
            INSERT INTO transactions (user_id, type, category, amount, date, notes, created_at) 
            VALUES (?, 'income', ?, ?, ?, ?, NOW())
        `;

        db.query(insertQuery, [userId, category, parseFloat(amount), date, notes || null], (err, result) => {
            if (err) {
                console.error(`Insert income transaction error for user ${userId}:`, err);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Failed to add income transaction' 
                });
            }

            console.log(`Income transaction added successfully for user ${userId}:`, {
                id: result.insertId,
                category,
                amount: parseFloat(amount)
            });

            res.status(201).json({
                success: true,
                message: 'Income transaction added successfully',
                data: {
                    id: result.insertId,
                    user_id: userId,
                    type: 'income',
                    category: category,
                    amount: parseFloat(amount),
                    date: date,
                    notes: notes
                }
            });
        });
    });
});

// Update an income transaction
router.put('/income/:transactionId', (req, res) => {
    const transactionId = parseInt(req.params.transactionId);
    const { category, amount, date, notes, user_id } = req.body;
    const db = req.app.locals.db;

    if (!transactionId || isNaN(transactionId) || transactionId <= 0) {
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid transaction ID' 
        });
    }

    const userId = parseInt(user_id);
    if (!userId || isNaN(userId) || userId <= 0) {
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid user_id' 
        });
    }

    // Check if transaction exists, belongs to user, and is income type
    const checkQuery = 'SELECT user_id FROM transactions WHERE id = ? AND user_id = ? AND type = "income"';
    
    db.query(checkQuery, [transactionId, userId], (err, checkResult) => {
        if (err) {
            console.error('Check income transaction error:', err);
            return res.status(500).json({ 
                success: false, 
                error: 'Database error' 
            });
        }

        if (checkResult.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Income transaction not found or does not belong to this user' 
            });
        }

        // Validation
        if (amount && (isNaN(amount) || parseFloat(amount) <= 0)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Amount must be a positive number' 
            });
        }

        // Build update query dynamically
        const updates = [];
        const values = [];

        if (category) {
            updates.push('category = ?');
            values.push(category);
        }
        if (amount) {
            updates.push('amount = ?');
            values.push(parseFloat(amount));
        }
        if (date) {
            updates.push('date = ?');
            values.push(date);
        }
        if (notes !== undefined) {
            updates.push('notes = ?');
            values.push(notes);
        }

        if (updates.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'No fields to update' 
            });
        }

        updates.push('updated_at = NOW()');
        values.push(transactionId, userId);

        const updateQuery = `UPDATE transactions SET ${updates.join(', ')} WHERE id = ? AND user_id = ? AND type = 'income'`;

        db.query(updateQuery, values, (err, result) => {
            if (err) {
                console.error('Update income transaction error:', err);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Failed to update income transaction' 
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Income transaction not found or no changes made' 
                });
            }

            console.log(`Income transaction ${transactionId} updated successfully for user ${userId}`);

            res.json({
                success: true,
                message: 'Income transaction updated successfully'
            });
        });
    });
});

// Delete an income transaction
router.delete('/income/:transactionId', (req, res) => {
    const transactionId = parseInt(req.params.transactionId);
    const userId = parseInt(req.query.user_id);
    const db = req.app.locals.db;

    if (!transactionId || isNaN(transactionId) || transactionId <= 0) {
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid transaction ID' 
        });
    }

    if (!userId || isNaN(userId) || userId <= 0) {
        return res.status(400).json({ 
            success: false, 
            error: 'Valid user_id is required' 
        });
    }

    // Check if transaction exists, belongs to user, and is income type
    const checkQuery = 'SELECT user_id FROM transactions WHERE id = ? AND user_id = ? AND type = "income"';
    
    db.query(checkQuery, [transactionId, userId], (err, checkResult) => {
        if (err) {
            console.error('Check income transaction error:', err);
            return res.status(500).json({ 
                success: false, 
                error: 'Database error' 
            });
        }

        if (checkResult.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Income transaction not found or does not belong to this user' 
            });
        }

        const deleteQuery = 'DELETE FROM transactions WHERE id = ? AND user_id = ? AND type = "income"';
        
        db.query(deleteQuery, [transactionId, userId], (err, result) => {
            if (err) {
                console.error('Delete income transaction error:', err);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Failed to delete income transaction' 
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Income transaction not found' 
                });
            }

            console.log(`Income transaction ${transactionId} deleted successfully for user ${userId}`);

            res.json({
                success: true,
                message: 'Income transaction deleted successfully'
            });
        });
    });
});

// Get income summary for a specific user with month/year filtering
router.get('/income-summary/:userId', (req, res) => {
    const userId = parseInt(req.params.userId);
    const db = req.app.locals.db;

    if (!userId || isNaN(userId) || userId <= 0) {
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid user ID' 
        });
    }

    // First verify user exists
    db.query('SELECT id, name FROM users WHERE id = ?', [userId], (err, userCheck) => {
        if (err) {
            console.error('User verification error:', err);
            return res.status(500).json({ success: false, error: 'Database error' });
        }

        if (userCheck.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: `User with ID ${userId} not found` 
            });
        }

        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        // Get month and year from query params or use current
        const month = parseInt(req.query.month) || currentMonth;
        const year = parseInt(req.query.year) || currentYear;

        console.log(`Fetching income summary for user ${userId}, month ${month}, year ${year}`);

        // Get total income for specified month/year
        const monthlyIncomeQuery = `
            SELECT COALESCE(SUM(amount), 0) as monthly_total 
            FROM transactions 
            WHERE user_id = ? AND type = 'income' 
            AND MONTH(date) = ? AND YEAR(date) = ?
        `;

        // Get total income for specified year
        const yearlyIncomeQuery = `
            SELECT COALESCE(SUM(amount), 0) as yearly_total 
            FROM transactions 
            WHERE user_id = ? AND type = 'income' 
            AND YEAR(date) = ?
        `;

        // Get income by category for specified month/year
        const categoryIncomeQuery = `
            SELECT category, SUM(amount) as total, COUNT(*) as count
            FROM transactions 
            WHERE user_id = ? AND type = 'income' 
            AND MONTH(date) = ? AND YEAR(date) = ?
            GROUP BY category 
            HAVING total > 0
            ORDER BY total DESC
        `;

        // Execute queries
        let completedQueries = 0;
        const totalQueries = 3;
        let results = {};
        let hasError = false;

        const checkComplete = () => {
            completedQueries++;
            if (completedQueries === totalQueries && !hasError) {
                res.json({
                    success: true,
                    data: {
                        userId: userId,
                        userName: userCheck[0].name,
                        monthlyTotal: parseFloat(results.monthly?.monthly_total) || 0,
                        yearlyTotal: parseFloat(results.yearly?.yearly_total) || 0,
                        incomeByCategory: results.categories || [],
                        month: month,
                        year: year
                    }
                });
            }
        };

        const handleError = (error, queryName) => {
            if (!hasError) {
                hasError = true;
                console.error(`${queryName} error for user ${userId}:`, error);
                res.status(500).json({ 
                    success: false, 
                    error: `Database error in ${queryName}` 
                });
            }
        };

        // Monthly income (filtered by month/year)
        db.query(monthlyIncomeQuery, [userId, month, year], (err, monthlyResult) => {
            if (err) return handleError(err, 'monthly income query');
            results.monthly = monthlyResult[0];
            checkComplete();
        });

        // Yearly income (filtered by year)
        db.query(yearlyIncomeQuery, [userId, year], (err, yearlyResult) => {
            if (err) return handleError(err, 'yearly income query');
            results.yearly = yearlyResult[0];
            checkComplete();
        });

        // Category breakdown (filtered by month/year)
        db.query(categoryIncomeQuery, [userId, month, year], (err, categoryResult) => {
            if (err) return handleError(err, 'category income query');
            results.categories = categoryResult;
            checkComplete();
        });
    });
});

// Test route for connectivity
router.get('/test', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Server is running and accessible',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;