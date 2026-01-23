// routes/auth.js - Authentication routes
const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

// Sign up route
router.post('/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const db = req.app.locals.db;

        // Check if user exists
        db.query('SELECT email FROM users WHERE email = ?', [email], async (err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            if (results.length > 0) {
                return res.status(400).json({ error: 'User already exists' });
            }
             
            const hashedPassword = await bcrypt.hash(password, 10);

            // Insert new user
            db.query(
                'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
                [name, email, hashedPassword],
                (err, result) => {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to create user' });
                    }

                    res.status(201).json({
                        success: true,
                        message: 'User created successfully',
                        user: { 
                            id: result.insertId, 
                            name: name, 
                            email: email 
                        }
                    });
                }
            );
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Login route
router.post('/login', (req, res) => {
    try {
        const { email, password } = req.body;
        const db = req.app.locals.db;

        // Find user by email
        db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            if (results.length === 0) {
                return res.status(400).json({ error: 'Invalid email or password' });
            }

            const user = results[0];

            // Check password
            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                return res.status(400).json({ error: 'Invalid email or password' });
            }

            res.json({
                success: true,
                message: 'Login successful',
                user: { 
                    id: user.id, 
                    name: user.name, 
                    email: user.email 
                }
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;