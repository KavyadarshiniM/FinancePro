const express = require('express');
const router = express.Router();

// Command-based parsing function using regex patterns
function parseFinancialCommand(text) {
    const lowerText = text.toLowerCase().trim();
    
    // Greeting patterns
    const greetingPatterns = /^(hi|hello|hey|good (morning|afternoon|evening)|greetings)/i;
    const isGreeting = greetingPatterns.test(lowerText);
    
    // Command patterns - exact command matching
    const addIncomePatterns = /(add income|record income|log income)/i;
    const isAddIncomeCommand = addIncomePatterns.test(lowerText);
    
    const addExpensePatterns = /(add expense|record expense|log expense)/i;
    const isAddExpenseCommand = addExpensePatterns.test(lowerText);
    
    const setBudgetPatterns = /(set budget|create budget|budget setup|budget.*for|set.*budget.*for)/i;
    const isSetBudgetCommand = setBudgetPatterns.test(lowerText) && /(monthly|budget)/i.test(lowerText);
    
    const downloadReportPatterns = /(download report|export report|generate report)/i;
    const isDownloadReportCommand = downloadReportPatterns.test(lowerText);
    
    // Investment advice patterns
    const investmentPatterns = /(where.*invest|should.*invest|investment.*advice|invest.*money|where.*should.*i.*invest)/i;
    const isInvestmentQuery = investmentPatterns.test(lowerText);
    
    // Balance/summary query patterns
    const balancePatterns = /(balance|summary|total|overview|status)/i;
    const isBalanceQuery = balancePatterns.test(lowerText) && !/(income|expense|invest)/i.test(lowerText);
    
    // Expense advice patterns
    const expenseAdvicePatterns = /(reduce.*expense|cut.*expense|save.*money|expense.*advice|suggestions.*reduce)/i;
    const isExpenseAdviceQuery = expenseAdvicePatterns.test(lowerText);
    
    // Transaction patterns
    const amountPattern = /\$?(\d+(?:\.\d{2})?)/;
    const amountMatch = lowerText.match(amountPattern);
    const amount = amountMatch ? parseFloat(amountMatch[1]) : null;
    
    // Transaction type patterns
    const incomeKeywords = /(earn|salary|bonus|income|got|receive|made)/i;
    const expenseKeywords = /(spend|spent|buy|bought|cost|paid|expense)/i;
    const addKeywords = /(add|record|log|enter)/i;
    const reduceKeywords = /(reduce|remove|subtract|delete)/i;
    
    const isIncome = incomeKeywords.test(lowerText);
    const isExpense = expenseKeywords.test(lowerText);
    const isAdd = addKeywords.test(lowerText);
    const isReduce = reduceKeywords.test(lowerText);
    
    // Category extraction
    let category = 'other';
    const categoryMappings = {
        'food': /(food|grocery|groceries|restaurant|dining|eat|meal|lunch|dinner|breakfast)/i,
        'transportation': /(transport|gas|fuel|car|bus|train|uber|taxi|flight|travel)/i,
        'entertainment': /(entertainment|movie|game|music|fun|party|concert|show)/i,
        'utilities': /(utilities|electric|water|internet|phone|bill|cable)/i,
        'healthcare': /(health|medical|doctor|medicine|hospital|pharmacy)/i,
        'shopping': /(shopping|clothes|clothing|shoes|electronics|amazon)/i,
        'salary': /(salary|paycheck|wage|work|job)/i,
        'freelance': /(freelance|contract|gig|side)/i,
        'business': /(business|profit|revenue|sale)/i,
        'investment': /(investment|dividend|stock|bond|crypto)/i,
        'gift': /(gift|present|bonus|tip)/i,
        'rent': /(rent|housing|apartment|mortgage)/i,
        'education': /(education|school|course|book|tuition)/i
    };
    
    for (const [cat, pattern] of Object.entries(categoryMappings)) {
        if (pattern.test(lowerText)) {
            category = cat;
            break;
        }
    }
    
    return {
        originalPrompt: text,
        isGreeting,
        isAddIncomeCommand,
        isAddExpenseCommand,
        isSetBudgetCommand,
        isDownloadReportCommand,
        isInvestmentQuery,
        isBalanceQuery,
        isExpenseAdviceQuery,
        amount,
        isIncome,
        isExpense,
        isAdd,
        isReduce,
        category
    };
}

// Financial summary function
async function getFinancialSummary(db, userId) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT 
                SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as totalIncome,
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as totalExpenses,
                COUNT(*) as transactionCount
            FROM transactions 
            WHERE user_id = ? 
            AND date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        `;
        
        db.query(query, [userId], (err, results) => {
            if (err) {
                reject(err);
                return;
            }
            
            const row = results[0];
            const totalIncome = parseFloat(row.totalIncome) || 0;
            const totalExpenses = parseFloat(row.totalExpenses) || 0;
            const balance = totalIncome - totalExpenses;
            
            resolve({
                totalIncome,
                totalExpenses,
                balance,
                transactionCount: row.transactionCount || 0
            });
        });
    });
}

// Add transaction function
async function addTransaction(db, userId, type, category, amount, description) {
    return new Promise((resolve, reject) => {
        const query = `INSERT INTO transactions (user_id, type, category, amount, notes, date, created_at, updated_at) 
                      VALUES (?, ?, ?, ?, ?, CURDATE(), NOW(), NOW())`;
        
        db.query(query, [userId, type, category, amount, description], (err, result) => {
            if (err) {
                reject(err);
                return;
            }
            
            resolve({
                transactionId: result.insertId,
                success: true
            });
        });
    });
}

// Set budget function
async function setBudget(db, userId, category, amount, period = 'monthly') {
    return new Promise((resolve, reject) => {
        // Get current date for month/year
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();
        
        // First, check if budget already exists for this category and current month
        const checkQuery = `SELECT * FROM budgets WHERE user_id = ? AND category = ? AND month = ? AND year = ?`;
        
        db.query(checkQuery, [userId, category, currentMonth, currentYear], (err, results) => {
            if (err) {
                reject(err);
                return;
            }
            
            if (results.length > 0) {
                // Update existing budget
                const updateQuery = `UPDATE budgets SET monthly_limit = ?, updated_at = NOW() 
                                   WHERE user_id = ? AND category = ? AND month = ? AND year = ?`;
                
                db.query(updateQuery, [amount, userId, category, currentMonth, currentYear], (err, result) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    resolve({
                        budgetId: results[0].id,
                        success: true,
                        action: 'updated'
                    });
                });
            } else {
                // Create new budget
                const insertQuery = `INSERT INTO budgets (user_id, category, monthly_limit, month, year, created_at, updated_at) 
                                   VALUES (?, ?, ?, ?, ?, NOW(), NOW())`;
                
                db.query(insertQuery, [userId, category, amount, currentMonth, currentYear], (err, result) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    resolve({
                        budgetId: result.insertId,
                        success: true,
                        action: 'created'
                    });
                });
            }
        });
    });
}

// Generate expense reduction advice based on financial profile
async function generateExpenseAdvice(db, userId) {
    try {
        const summary = await getFinancialSummary(db, userId);
        const suggestions = [];
        
        const expenseRatio = summary.totalExpenses / (summary.totalIncome || 1);
        
        suggestions.push("💰 Expense Reduction Strategies:");
        suggestions.push("");
        
        if (expenseRatio > 0.8) {
            suggestions.push("🚨 Critical: Expenses are very high (>80% of income)");
            suggestions.push("• Track every expense for 30 days");
            suggestions.push("• Cancel all non-essential subscriptions");
            suggestions.push("• Cook at home instead of eating out");
            suggestions.push("• Use public transport or carpool");
            suggestions.push("• Shop with a strict grocery list");
        } else if (expenseRatio > 0.6) {
            suggestions.push("⚠️ High expenses (>60% of income) - room for improvement:");
            suggestions.push("• Review and cancel unused subscriptions");
            suggestions.push("• Plan meals and batch cook");
            suggestions.push("• Compare prices before major purchases");
            suggestions.push("• Use cashback and discount apps");
            suggestions.push("• Set a weekly spending limit");
        } else if (expenseRatio > 0.4) {
            suggestions.push("✅ Moderate expenses (40-60% of income) - good optimization opportunities:");
            suggestions.push("• Automate savings to avoid overspending");
            suggestions.push("• Use the envelope budgeting method");
            suggestions.push("• Review insurance rates annually");
            suggestions.push("• Buy generic brands for basics");
            suggestions.push("• Negotiate bills (phone, internet, etc.)");
        } else {
            suggestions.push("🌟 Great expense control (<40% of income)!");
            suggestions.push("• Maintain your current spending discipline");
            suggestions.push("• Consider increasing retirement contributions");
            suggestions.push("• Build a larger emergency fund");
            suggestions.push("• Invest the excess wisely");
        }
        
        suggestions.push("");
        suggestions.push("💡 Universal Money-Saving Tips:");
        suggestions.push("• Use the 24-hour rule for non-essential purchases");
        suggestions.push("• Audit your bank statements monthly");
        suggestions.push("• Use a spending tracking app");
        suggestions.push("• Set up automatic transfers to savings");
        suggestions.push("• Compare prices online before buying");
        
        return suggestions;
    } catch (error) {
        return [
            "❌ Unable to generate personalized expense advice right now.",
            "",
            "💰 General Expense Reduction Tips:",
            "• Track all expenses for better awareness",
            "• Cancel unused subscriptions and memberships",
            "• Cook at home more often",
            "• Use public transportation when possible",
            "• Shop with a list and stick to it",
            "• Compare prices before major purchases",
            "• Set up automatic savings transfers"
        ];
    }
}

// Rule-based investment advice function
async function generateInvestmentAdvice(db, userId) {
    try {
        const summary = await getFinancialSummary(db, userId);
        const savings = summary.balance;
        
        if (savings < 1000) {
            return [
                "💡 Build Your Foundation First:",
                "",
                "• Focus on emergency funds (FD, RD)",
                "• Start a recurring deposit with ₹500-1000/month",
                "• Consider high-yield savings accounts",
                "• Target: Build ₹1000 emergency fund first",
                "",
                "� Action Steps:",
                "• Open FD with 6-8% returns",
                "• Set up automatic savings transfers",
                "• Track expenses to increase savings rate"
            ];
        } else if (savings >= 1000 && savings < 5000) {
            return [
                "🥇 Safe Investment Options:",
                "",
                "• Gold ETFs or Digital Gold (10-15%)",
                "• Term Insurance + ULIP (20-25%)",
                "• Continue FD/RD for emergency fund (60-70%)",
                "",
                "📋 Recommended Actions:",
                "• Invest ₹1000-2000 in Gold ETFs",
                "• Get term life insurance coverage",
                "• Maintain liquid emergency fund"
            ];
        } else if (savings >= 5000 && savings <= 20000) {
            return [
                "🚀 Growth-Focused Portfolio:",
                "",
                "• SIP in Index Funds (40-50%)",
                "• Diversified Mutual Funds (30-35%)",
                "• Emergency Fund FD (15-20%)",
                "• Gold/ELSS for tax saving (5-10%)",
                "",
                "📋 Action Plan:",
                "• Start SIP with ₹2000-5000/month",
                "• Choose large-cap + mid-cap funds",
                "• Use SIP for rupee cost averaging"
            ];
        } else {
            return [
                "💎 Diversified Wealth Building:",
                "",
                "• Stock Market Direct Equity (30-40%)",
                "• Mutual Fund SIPs (25-30%)",
                "• Real Estate/REITs (15-20%)",
                "• International Funds (10-15%)",
                "• Emergency Fund (5-10%)",
                "",
                "📋 Advanced Strategies:",
                "• Research blue-chip stocks",
                "• Consider real estate investment",
                "• Explore international diversification",
                "• Regular portfolio rebalancing"
            ];
        }
    } catch (error) {
        return [
            "❌ Unable to get your balance right now.",
            "",
            "💡 General Investment Rules:",
            "• Emergency fund first (3-6 months expenses)",
            "• Start with safe options (FD, RD)",
            "• Gradually move to growth investments",
            "• Never invest money you need immediately"
        ];
    }
}

// Main chatbot endpoint
router.post('/:userId', async (req, res) => {
    try {
        const { prompt } = req.body;
        const { userId } = req.params;
        
        if (!prompt || !userId) {
            return res.status(400).json({
                success: false,
                error: 'Message and userId are required'
            });
        }
        
        // Get database connection from app locals
        const db = req.app.locals.db;
        
        // Parse the command
        const parsed = parseFinancialCommand(prompt);
        
        // Handle greetings
        if (parsed.isGreeting) {
            return res.json({
                success: true,
                response: "Hello! 👋 I'm your personal finance assistant.",
                suggestions: [
                    "Commands I understand:",
                    "• 'add income' - Record new income",
                    "• 'add expense' - Record new expense", 
                    "• 'set budget' - Set monthly budget",
                    "• 'download report' - Export financial data",
                    "• 'where should I invest?' - Get investment advice",
                    "• 'balance' - Check your current balance"
                ]
            });
        }
        
        // Handle specific commands
        if (parsed.isAddIncomeCommand) {
            return res.json({
                success: true,
                response: "💰 Add Income Command Detected!\n\nPlease provide the income amount.",
                suggestions: [
                    "Example responses:",
                    "• '$2500 salary'",
                    "• '$500 freelance work'",
                    "• '$200 bonus'"
                ]
            });
        }
        
        if (parsed.isAddExpenseCommand) {
            return res.json({
                success: true,
                response: "🛒 Add Expense Command Detected!\n\nPlease provide the expense amount and category.",
                suggestions: [
                    "Example responses:",
                    "• '$50 groceries'",
                    "• '$25 transportation'",
                    "• '$100 utilities'"
                ]
            });
        }
        
        if (parsed.isSetBudgetCommand && parsed.amount) {
            // Create budget in database
            const budgetResult = await setBudget(db, userId, parsed.category, parsed.amount, 'monthly');
            
            return res.json({
                success: true,
                response: `📊 Budget Successfully Set!\n\n💰 Category: ${parsed.category.charAt(0).toUpperCase() + parsed.category.slice(1)}\n💵 Amount: $${parsed.amount.toFixed(2)}\n📅 Period: Monthly`,
                budget: {
                    category: parsed.category,
                    amount: parsed.amount,
                    period: 'monthly'
                }
            });
        } else if (parsed.isSetBudgetCommand) {
            return res.json({
                success: true,
                response: "📊 Set Budget Command Detected!\n\nPlease specify your monthly budget amount and category.",
                suggestions: [
                    "Example responses:",
                    "• 'Set budget for food $500 monthly'",
                    "• 'Budget $1500 for rent monthly'",
                    "• 'Set $300 budget for transportation'"
                ]
            });
        }
        
        if (parsed.isDownloadReportCommand) {
            return res.json({
                success: true,
                response: "📄 Download Report Command Detected!\n\nWhich format would you prefer?",
                suggestions: [
                    "Available formats:",
                    "• 'PDF format'",
                    "• 'Excel format'",
                    "• 'CSV format'"
                ]
            });
        }
        
        // Handle balance queries
        if (parsed.isBalanceQuery) {
            const summary = await getFinancialSummary(db, userId);
            return res.json({
                success: true,
                response: `💰 Your Financial Summary (Last 30 days):\n\n📈 Total Income: $${summary.totalIncome.toFixed(2)}\n📉 Total Expenses: $${summary.totalExpenses.toFixed(2)}\n💵 Net Balance: $${summary.balance.toFixed(2)}\n📊 Total Transactions: ${summary.transactionCount}`,
                financialData: summary
            });
        }
        
        // Handle income queries
        if (parsed.isIncomeQuery) {
            const summary = await getFinancialSummary(db, userId);
            return res.json({
                success: true,
                response: `📈 Your Income Summary (Last 30 days):\n\nTotal Income: $${summary.totalIncome.toFixed(2)}`,
                suggestions: [
                    "💡 Income tips:",
                    "• Diversify your income sources",
                    "• Consider side hustles or freelancing",
                    "• Ask for salary reviews annually"
                ]
            });
        }
        
        // Handle expense queries
        if (parsed.isExpenseQuery) {
            const summary = await getFinancialSummary(db, userId);
            return res.json({
                success: true,
                response: `📉 Your Expense Summary (Last 30 days):\n\nTotal Expenses: $${summary.totalExpenses.toFixed(2)}`,
                suggestions: [
                    "💡 Expense management tips:",
                    "• Follow the 50/30/20 rule",
                    "• Review and cancel unused subscriptions",
                    "• Compare prices before major purchases"
                ]
            });
        }
        
        // Handle investment advice queries
        if (parsed.isInvestmentQuery) {
            const investmentAdvice = await generateInvestmentAdvice(db, userId);
            const summary = await getFinancialSummary(db, userId);
            
            return res.json({
                success: true,
                response: `💼 Investment Advice (Based on your balance: $${summary.balance.toFixed(2)})`,
                suggestions: investmentAdvice
            });
        }
        
        // Handle expense reduction advice queries
        if (parsed.isExpenseAdviceQuery) {
            const expenseAdvice = await generateExpenseAdvice(db, userId);
            
            return res.json({
                success: true,
                response: "💰 Here are personalized expense reduction strategies based on your spending patterns:",
                suggestions: expenseAdvice
            });
        }
        
        // Handle transaction processing (exclude budget commands)
        if (parsed.amount && !parsed.isSetBudgetCommand) {
            // Determine transaction type and action
            let transactionType = '';
            let actualAmount = parsed.amount;
            
            if (parsed.isIncome || (!parsed.isExpense && parsed.isAdd)) {
                transactionType = 'income';
            } else {
                transactionType = 'expense';
            }
            
            // For reduce operations, we need to add a negative transaction
            if (parsed.isReduce) {
                actualAmount = -Math.abs(parsed.amount);
            }
            
            // Insert transaction into database
            const transactionResult = await addTransaction(db, userId, transactionType, parsed.category, actualAmount, `Chatbot: ${parsed.originalPrompt}`);
            
            // Create response
            const action = parsed.isReduce ? 'reduced' : 'added';
            const responseText = `✅ Successfully ${action} $${Math.abs(actualAmount)} ${transactionType} in ${parsed.category} category.`;
            
            return res.json({
                success: true,
                response: responseText,
                transaction: {
                    id: transactionResult.transactionId,
                    type: transactionType,
                    category: parsed.category,
                    amount: actualAmount,
                    date: new Date().toISOString().split('T')[0]
                }
            });
        }
        
        // Default response for unrecognized commands
        return res.json({
            success: true,
            response: "❓ I didn't recognize that command. Please try one of these:",
            suggestions: [
                "� Available Commands:",
                "• 'add income' - Record new income",
                "• 'add expense' - Record new expense",
                "• 'set budget' - Set monthly budget", 
                "• 'download report' - Export data",
                "• 'where should I invest?' - Investment advice",
                "• 'balance' - Check your balance",
                "",
                "💡 Type the exact commands above for best results!"
            ]
        });
        
    } catch (error) {
        console.error('Chatbot error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

module.exports = router;