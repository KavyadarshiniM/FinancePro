// test-reports.js - Test script to verify reports functionality
const mysql = require('mysql2');

// Database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'kavya@2005',
    database: 'personal_finance_db'
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err);
        return;
    }
    console.log('Connected to MySQL database');
    
    // Test basic queries
    testReports();
});

function testReports() {
    console.log('\n=== Testing Reports Functionality ===');
    
    // Test 1: Check if users table exists and has data
    db.query('SELECT COUNT(*) as userCount FROM users', (err, results) => {
        if (err) {
            console.error('Error checking users:', err);
        } else {
            console.log(`✓ Users table: ${results[0].userCount} users found`);
        }
    });
    
    // Test 2: Check if transactions table exists and has data
    db.query('SELECT COUNT(*) as transactionCount FROM transactions', (err, results) => {
        if (err) {
            console.error('Error checking transactions:', err);
        } else {
            console.log(`✓ Transactions table: ${results[0].transactionCount} transactions found`);
        }
    });
    
    // Test 3: Test reports query for user 1
    const userId = 1;
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    
    const summaryQuery = `
        SELECT 
            type,
            COUNT(*) as transaction_count,
            COALESCE(SUM(amount), 0) as total_amount,
            COALESCE(AVG(amount), 0) as average_amount
        FROM transactions 
        WHERE user_id = ? AND MONTH(date) = ? AND YEAR(date) = ?
        GROUP BY type
    `;
    
    db.query(summaryQuery, [userId, currentMonth, currentYear], (err, results) => {
        if (err) {
            console.error('Error testing reports query:', err);
        } else {
            console.log(`✓ Reports query for user ${userId} (${currentMonth}/${currentYear}):`, results);
        }
        
        // Close connection
        db.end();
    });
}
