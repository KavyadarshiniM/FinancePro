
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'kavya@2005',
    database: process.env.DB_NAME || 'personal_finance_db'
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Make db available to routes
app.locals.db = db;

// Import routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const incomeRoutes = require('./routes/income');
const expenseRoutes = require('./routes/expense');
const budgetRoutes = require('./routes/budget'); 
const chatbotRoutes = require('./routes/chatbot');
const reportsRoutes = require('./routes/reports');
const aiRoutes = require('./routes/ai');

app.use('/api/auth', authRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', incomeRoutes);
app.use('/api', expenseRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api', budgetRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/ai', aiRoutes);


// 
app.get('/', (req, res) => {
    res.json({ message: 'Personal Finance Manager API is running!' });
});


app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'API connection successful!', 
        timestamp: new Date().toISOString(),
        database: 'Connected'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
