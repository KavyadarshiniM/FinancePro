const express = require("express");
const router = express.Router();

// GET expense data for AI prediction for a specific user
router.get("/expenses/:userId", (req, res) => {
  const userId = Number.parseInt(req.params.userId);
  const db = req.app.locals.db;

  // Validate userId
  if (!userId || isNaN(userId) || userId <= 0) {
    return res.status(400).json({
      success: false,
      error: "Invalid user ID. Must be a positive integer.",
    });
  }

  // First verify user exists (same pattern as your routes)
  db.query("SELECT id FROM users WHERE id = ?", [userId], (err, userCheck) => {
    if (err) {
      console.error("User verification error:", err);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    if (userCheck.length === 0) {
      return res.status(404).json({
        success: false,
        error: `User with ID ${userId} not found`,
      });
    }

    // 🔹 THIS QUERY IS FOR AI (IMPORTANT PART)
    const aiQuery = `
      SELECT 
        MONTH(date) AS month, 
        SUM(amount) AS total
      FROM transactions
      WHERE user_id = ? AND type = 'expense'
      GROUP BY MONTH(date)
      ORDER BY MONTH(date) ASC;
    `;

    db.query(aiQuery, [userId], (err, results) => {
      if (err) {
        console.error("AI data fetch error:", err);
        return res.status(500).json({ success: false, error: "Database error" });
      }

      // Format data properly for Python AI
      const formattedData = results.map(row => ({
        month: row.month,
        total: Number(row.total)
      }));

      res.json(formattedData);
    });
  });
});

module.exports = router;
