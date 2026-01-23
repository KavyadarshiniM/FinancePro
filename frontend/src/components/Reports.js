"use client"

import { useState, useEffect, useRef } from "react"
import axios from "axios"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"
import "../css/Reports.css"

// Configure axios base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000"
axios.defaults.baseURL = API_BASE_URL

const Reports = ({ user }) => {
  const [activeReport, setActiveReport] = useState("financial-summary")
  const [reportData, setReportData] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
    useRange: false,
  })
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [comparisonPeriod, setComparisonPeriod] = useState({
    currentMonth: new Date().getMonth() + 1,
    currentYear: new Date().getFullYear(),
    compareMonth: new Date().getMonth() === 0 ? 12 : new Date().getMonth(),
    compareYear: new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear(),
  })
  const [monthsToShow, setMonthsToShow] = useState(12)

  // Refs for chart downloads
  const chartsRef = useRef([])

  const reportTypes = [
    { id: "financial-summary", name: "Financial Summary", icon: "📊" },
    { id: "category-analysis", name: "Category Analysis", icon: "🏷️" },
    { id: "budget-performance", name: "Budget Performance", icon: "🎯" },
    { id: "cash-flow", name: "Cash Flow", icon: "💰" },
    { id: "trend-analysis", name: "Trend Analysis", icon: "📈" },
    { id: "comparison", name: "Period Comparison", icon: "⚖️" },
  ]

  const COLORS = [
    "#3B82F6",
    "#EF4444",
    "#10B981",
    "#F59E0B",
    "#8B5CF6",
    "#EC4899",
    "#06B6D4",
    "#84CC16",
    "#F97316",
    "#6366F1",
    "#14B8A6",
    "#F43F5E",
  ]

  useEffect(() => {
    if (user && user.id) {
      fetchReportData()
    }
  }, [user, activeReport, dateRange, selectedMonth, selectedYear, comparisonPeriod, monthsToShow])

  const fetchReportData = async () => {
    if (!user || !user.id) return

    setLoading(true)
    setError("")

    try {
      const url = `/api/reports/${activeReport}/${user.id}`
      let params = {}

      // Handle different parameter requirements for different report types
      switch (activeReport) {
        case "financial-summary":
        case "category-analysis":
          if (dateRange.useRange && dateRange.startDate && dateRange.endDate) {
            params = { startDate: dateRange.startDate, endDate: dateRange.endDate }
          } else {
            params = { month: selectedMonth, year: selectedYear }
          }
          break
        case "budget-performance":
          params = { month: selectedMonth, year: selectedYear }
          break
        case "cash-flow":
        case "trend-analysis":
          if (dateRange.useRange && dateRange.startDate && dateRange.endDate) {
            params = { startDate: dateRange.startDate, endDate: dateRange.endDate }
          } else {
            params = { months: monthsToShow }
          }
          break
        case "comparison":
          params = comparisonPeriod
          break
      }

      const response = await axios.get(url, { params, timeout: 15000 })

      if (response.data && response.data.success) {
        setReportData(response.data.data)
      } else {
        throw new Error(response.data?.error || "Failed to fetch report data")
      }
    } catch (error) {
      console.error("Error fetching report data:", error)
      let errorMessage = "Failed to fetch report data"
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error
      } else if (error.code === "ECONNREFUSED") {
        errorMessage = "Cannot connect to server. Please check if the server is running."
      }
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount || 0)
  }

  const formatPercentage = (value, decimals = 1) => {
    return `${(value || 0).toFixed(decimals)}%`
  }

  const toggleFilterMode = () => {
    setDateRange((prev) => ({ ...prev, useRange: !prev.useRange }))
  }

  const clearDateRange = () => {
    setDateRange({ startDate: "", endDate: "", useRange: false })
  }

  const downloadExcelReport = async () => {
    try {
      // Dynamic import for xlsx library
      const XLSX = await import("xlsx")

      const reportName = reportTypes.find((r) => r.id === activeReport)?.name
      const fileName = `${reportName}_${new Date().toISOString().split("T")[0]}.xlsx`

      // Create workbook
      const workbook = XLSX.utils.book_new()

      // Add report metadata sheet
      const metadataSheet = XLSX.utils.aoa_to_sheet([
        ["Report Name", reportName],
        ["Generated For", user?.name || "User"],
        ["Generated On", new Date().toLocaleDateString()],
        ["Report Type", activeReport],
        [""],
        ["Report Data Summary:"],
      ])
      XLSX.utils.book_append_sheet(workbook, metadataSheet, "Report Info")

      // Add data sheets based on report type
      switch (activeReport) {
        case "financial-summary":
          if (reportData.summary) {
            const summaryData = [
              ["Metric", "Amount"],
              ["Total Income", reportData.summary.totalIncome],
              ["Total Expenses", reportData.summary.totalExpenses],
              ["Net Balance", reportData.summary.balance],
              ["Savings Rate (%)", reportData.summary.savingsRate],
              ["Income Transactions", reportData.summary.incomeTransactions],
              ["Expense Transactions", reportData.summary.expenseTransactions],
            ]
            const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
            XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary")
          }

          if (reportData.monthlyBreakdown) {
            const monthlyData = [["Month", "Year", "Income", "Expenses", "Balance"]]
            reportData.monthlyBreakdown.forEach((month) => {
              monthlyData.push([
                month.month_name,
                month.year,
                month.monthly_income,
                month.monthly_expenses,
                month.balance,
              ])
            })
            const monthlySheet = XLSX.utils.aoa_to_sheet(monthlyData)
            XLSX.utils.book_append_sheet(workbook, monthlySheet, "Monthly Breakdown")
          }

          if (reportData.categoryBreakdown) {
            const categoryData = [["Category", "Type", "Total Amount", "Transaction Count", "Average Amount"]]
            reportData.categoryBreakdown.forEach((cat) => {
              categoryData.push([cat.category, cat.type, cat.total, cat.transaction_count, cat.average_amount])
            })
            const categorySheet = XLSX.utils.aoa_to_sheet(categoryData)
            XLSX.utils.book_append_sheet(workbook, categorySheet, "Categories")
          }
          break

        case "category-analysis":
          if (reportData.categorySpending) {
            const categoryData = [
              ["Category", "Type", "Total Amount", "Transaction Count", "Avg Amount", "Min Amount", "Max Amount"],
            ]
            reportData.categorySpending.forEach((cat) => {
              categoryData.push([
                cat.category,
                cat.type,
                cat.total_amount,
                cat.transaction_count,
                cat.avg_amount,
                cat.min_amount,
                cat.max_amount,
              ])
            })
            const categorySheet = XLSX.utils.aoa_to_sheet(categoryData)
            XLSX.utils.book_append_sheet(workbook, categorySheet, "Category Analysis")
          }
          break

        case "budget-performance":
          if (reportData.budgetVsActual) {
            const budgetData = [["Category", "Monthly Limit", "Actual Spent", "Usage %", "Remaining", "Transactions"]]
            reportData.budgetVsActual.forEach((budget) => {
              budgetData.push([
                budget.category,
                budget.monthly_limit,
                budget.actual_spent,
                budget.usage_percentage,
                budget.remaining,
                budget.transaction_count,
              ])
            })
            const budgetSheet = XLSX.utils.aoa_to_sheet(budgetData)
            XLSX.utils.book_append_sheet(workbook, budgetSheet, "Budget Performance")
          }
          break

        case "cash-flow":
          if (reportData.monthlyCashFlow) {
            const cashFlowData = [["Month", "Year", "Income", "Expenses", "Net Cash Flow"]]
            reportData.monthlyCashFlow.forEach((month) => {
              cashFlowData.push([month.month_name, month.year, month.income, month.expenses, month.net_cash_flow])
            })
            const cashFlowSheet = XLSX.utils.aoa_to_sheet(cashFlowData)
            XLSX.utils.book_append_sheet(workbook, cashFlowSheet, "Cash Flow")
          }
          break

        case "trend-analysis":
          if (reportData.monthlyTrends) {
            const trendData = [
              ["Month", "Year", "Income", "Expenses", "Balance", "Income Growth %", "Expense Growth %"],
            ]
            reportData.monthlyTrends.forEach((trend) => {
              trendData.push([
                trend.month_name,
                trend.year,
                trend.monthly_income,
                trend.monthly_expenses,
                trend.monthly_balance,
                trend.income_growth_rate,
                trend.expense_growth_rate,
              ])
            })
            const trendSheet = XLSX.utils.aoa_to_sheet(trendData)
            XLSX.utils.book_append_sheet(workbook, trendSheet, "Trends")
          }
          break

        case "comparison":
          if (reportData.summary) {
            const comparisonData = [
              ["Metric", "Current Period", "Previous Period", "Change %", "Absolute Change"],
              [
                "Income",
                reportData.summary.current.income,
                reportData.summary.comparison.income,
                reportData.summary.changes.income_change,
                reportData.summary.changes.income_absolute_change,
              ],
              [
                "Expenses",
                reportData.summary.current.expenses,
                reportData.summary.comparison.expenses,
                reportData.summary.changes.expense_change,
                reportData.summary.changes.expense_absolute_change,
              ],
              [
                "Balance",
                reportData.summary.current.balance,
                reportData.summary.comparison.balance,
                "",
                reportData.summary.changes.balance_change,
              ],
            ]
            const comparisonSheet = XLSX.utils.aoa_to_sheet(comparisonData)
            XLSX.utils.book_append_sheet(workbook, comparisonSheet, "Comparison")
          }
          break
      }

      // Write and download the file
      XLSX.writeFile(workbook, fileName)
    } catch (error) {
      console.error("Error creating Excel file:", error)
      // Fallback to CSV if XLSX fails
      downloadCSVReport()
    }
  }

  const downloadCSVReport = () => {
    const reportName = reportTypes.find((r) => r.id === activeReport)?.name
    const fileName = `${reportName}_${new Date().toISOString().split("T")[0]}.csv`

    const csvContent = generateCSVContent()

    const dataBlob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)
  }

  const generateCSVContent = () => {
    const reportName = reportTypes.find((r) => r.id === activeReport)?.name
    let csvContent = `${reportName} Report\n`
    csvContent += `Generated for: ${user?.name || "User"}\n`
    csvContent += `Generated on: ${new Date().toLocaleDateString()}\n\n`

    switch (activeReport) {
      case "financial-summary":
        if (reportData.summary) {
          csvContent += "FINANCIAL SUMMARY\n"
          csvContent += "Metric,Amount\n"
          csvContent += `Total Income,${reportData.summary.totalIncome}\n`
          csvContent += `Total Expenses,${reportData.summary.totalExpenses}\n`
          csvContent += `Net Balance,${reportData.summary.balance}\n`
          csvContent += `Savings Rate,${reportData.summary.savingsRate}%\n`
          csvContent += `Income Transactions,${reportData.summary.incomeTransactions}\n`
          csvContent += `Expense Transactions,${reportData.summary.expenseTransactions}\n\n`
        }

        if (reportData.monthlyBreakdown) {
          csvContent += "MONTHLY BREAKDOWN\n"
          csvContent += "Month,Year,Income,Expenses,Balance\n"
          reportData.monthlyBreakdown.forEach((month) => {
            csvContent += `${month.month_name},${month.year},${month.monthly_income},${month.monthly_expenses},${month.balance}\n`
          })
          csvContent += "\n"
        }

        if (reportData.categoryBreakdown) {
          csvContent += "CATEGORY BREAKDOWN\n"
          csvContent += "Category,Type,Total Amount,Transaction Count,Average Amount\n"
          reportData.categoryBreakdown.forEach((cat) => {
            csvContent += `${cat.category},${cat.type},${cat.total},${cat.transaction_count},${cat.average_amount}\n`
          })
        }
        break

      case "category-analysis":
        if (reportData.categorySpending) {
          csvContent += "CATEGORY SPENDING\n"
          csvContent += "Category,Type,Total Amount,Transaction Count,Avg Amount,Min Amount,Max Amount\n"
          reportData.categorySpending.forEach((cat) => {
            csvContent += `${cat.category},${cat.type},${cat.total_amount},${cat.transaction_count},${cat.avg_amount},${cat.min_amount},${cat.max_amount}\n`
          })
          csvContent += "\n"
        }

        if (reportData.topCategories) {
          csvContent += "TOP SPENDING CATEGORIES\n"
          csvContent += "Category,Total Spent,Transactions,Percentage of Total\n"
          reportData.topCategories.forEach((cat) => {
            csvContent += `${cat.category},${cat.total_spent},${cat.transactions},${cat.percentage_of_total}%\n`
          })
        }
        break

      case "budget-performance":
        if (reportData.budgetVsActual) {
          csvContent += "BUDGET VS ACTUAL\n"
          csvContent += "Category,Monthly Limit,Actual Spent,Usage Percentage,Remaining,Transaction Count\n"
          reportData.budgetVsActual.forEach((budget) => {
            csvContent += `${budget.category},${budget.monthly_limit},${budget.actual_spent},${budget.usage_percentage}%,${budget.remaining},${budget.transaction_count}\n`
          })
        }
        break

      case "cash-flow":
        if (reportData.monthlyCashFlow) {
          csvContent += "MONTHLY CASH FLOW\n"
          csvContent += "Month,Year,Income,Expenses,Net Cash Flow\n"
          reportData.monthlyCashFlow.forEach((month) => {
            csvContent += `${month.month_name},${month.year},${month.income},${month.expenses},${month.net_cash_flow}\n`
          })
        }
        break

      case "trend-analysis":
        if (reportData.monthlyTrends) {
          csvContent += "MONTHLY TRENDS\n"
          csvContent += "Month,Year,Income,Expenses,Balance,Income Growth,Expense Growth\n"
          reportData.monthlyTrends.forEach((trend) => {
            csvContent += `${trend.month_name},${trend.year},${trend.monthly_income},${trend.monthly_expenses},${trend.monthly_balance},${trend.income_growth_rate}%,${trend.expense_growth_rate}%\n`
          })
        }
        break

      case "comparison":
        if (reportData.summary) {
          csvContent += "PERIOD COMPARISON\n"
          csvContent += "Metric,Current Period,Previous Period,Change\n"
          csvContent += `Income,${reportData.summary.current.income},${reportData.summary.comparison.income},${reportData.summary.changes.income_change}%\n`
          csvContent += `Expenses,${reportData.summary.current.expenses},${reportData.summary.comparison.expenses},${reportData.summary.changes.expense_change}%\n`
          csvContent += `Balance,${reportData.summary.current.balance},${reportData.summary.comparison.balance},${reportData.summary.changes.balance_change}\n`
        }
        break
    }

    return csvContent
  }

  const downloadChartsAsImages = async () => {
    try {
      // Use proper default imports for better compatibility
      const { default: html2canvas } = await import("html2canvas")
      const { default: JSZip } = await import("jszip")
      const zip = new JSZip()

      const reportName = reportTypes.find((r) => r.id === activeReport)?.name
      const chartContainers = document.querySelectorAll(".chart-container")

      if (chartContainers.length === 0) {
        alert("No charts found to export")
        return
      }

      let addedCount = 0

      for (let i = 0; i < chartContainers.length; i++) {
        const container = chartContainers[i]
        const chartTitle = container.querySelector("h3")?.textContent || `Chart_${i + 1}`

        try {
          // Force a white background to avoid transparency lines
          const canvas = await html2canvas(container, {
            backgroundColor: "#ffffff",
            scale: 2,
            logging: false,
            useCORS: true,
          })

          await new Promise((resolve, reject) => {
            canvas.toBlob(
              (blob) => {
                if (!blob) return reject(new Error("Failed to create image blob"))
                zip.file(`${chartTitle.replace(/[^a-zA-Z0-9]/g, "_")}.png`, blob)
                addedCount++
                resolve()
              },
              "image/png",
              0.92,
            )
          })
        } catch (err) {
          console.error(`Error capturing chart ${i + 1}:`, err)
        }
      }

      if (addedCount === 0) {
        alert("Could not capture any charts as images.")
        return
      }

      const zipBlob = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(zipBlob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${reportName}_Charts_${new Date().toISOString().split("T")[0]}.zip`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error downloading charts as images:", error)
      alert("Unable to export charts as images in this environment.")
    }
  }

  const downloadChartsAsJSON = () => {
    try {
      const reportName = reportTypes.find((r) => r.id === activeReport)?.name
      const fileName = `${reportName}_Charts_${new Date().toISOString().split("T")[0]}.json`

      const chartData = extractChartData()

      const chartBlob = new Blob([JSON.stringify(chartData, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(chartBlob)
      const link = document.createElement("a")
      link.href = url
      link.download = fileName
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error downloading charts as JSON:", error)
      alert("Error downloading chart data")
    }
  }

  const extractChartData = () => {
    const charts = []

    switch (activeReport) {
      case "financial-summary":
        if (reportData.monthlyBreakdown) {
          charts.push({
            type: "bar",
            title: "Monthly Income vs Expenses",
            data: reportData.monthlyBreakdown.map((month) => ({
              month: `${month.month_name} ${month.year}`,
              income: month.monthly_income,
              expenses: month.monthly_expenses,
            })),
          })
        }
        if (reportData.categoryBreakdown) {
          const expenseCategories = reportData.categoryBreakdown.filter((cat) => cat.type === "expense").slice(0, 8)
          charts.push({
            type: "pie",
            title: "Top Expense Categories",
            data: expenseCategories.map((cat) => ({
              category: cat.category,
              value: cat.total,
            })),
          })
        }
        break

      case "trend-analysis":
        if (reportData.monthlyTrends) {
          charts.push({
            type: "line",
            title: "Monthly Trends",
            data: reportData.monthlyTrends.map((trend) => ({
              period: `${trend.month_name} ${trend.year}`,
              income: trend.monthly_income,
              expenses: trend.monthly_expenses,
              balance: trend.monthly_balance,
            })),
          })
        }
        break

      // Add more chart data extraction for other report types
      default:
        charts.push({
          type: "data",
          title: "Raw Report Data",
          data: reportData,
        })
    }

    return {
      reportType: activeReport,
      reportName: reportTypes.find((r) => r.id === activeReport)?.name,
      generatedAt: new Date().toISOString(),
      generatedFor: user?.name || "User",
      charts: charts,
    }
  }

  const downloadReport = () => {
    const reportName = reportTypes.find((r) => r.id === activeReport)?.name
    const fileName = `${reportName}_${new Date().toISOString().split("T")[0]}.json`

    const payload = {
      reportType: activeReport,
      reportName: reportName,
      generatedAt: new Date().toISOString(),
      generatedFor: user?.name || "User",
      filters: {
        dateRange,
        selectedMonth,
        selectedYear,
        comparisonPeriod,
        monthsToShow,
      },
      data: reportData,
    }

    const dataBlob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)
  }

  const renderFinancialSummary = () => {
    if (!reportData.summary) return null

    const { summary, monthlyBreakdown, categoryBreakdown } = reportData

    // Prepare chart data
    const monthlyChartData =
      monthlyBreakdown?.map((month) => ({
        month: `${month.month_name.substring(0, 3)} ${month.year}`,
        income: month.monthly_income,
        expenses: month.monthly_expenses,
        balance: month.balance,
      })) || []

    const expenseCategories =
      categoryBreakdown
        ?.filter((cat) => cat.type === "expense")
        .slice(0, 8)
        .map((cat) => ({
          category: cat.category,
          total: cat.total,
          count: cat.transaction_count,
        })) || []

    return (
      <div className="report-content">
        <div className="summary-cards">
          <div className="summary-card income">
            <div className="card-header">
              <h3>Total Income</h3>
              <span className="card-icon">💰</span>
            </div>
            <div className="card-amount">{formatCurrency(summary.totalIncome)}</div>
            <div className="card-subtitle">{summary.incomeTransactions} transactions</div>
          </div>

          <div className="summary-card expense">
            <div className="card-header">
              <h3>Total Expenses</h3>
              <span className="card-icon">💸</span>
            </div>
            <div className="card-amount">{formatCurrency(summary.totalExpenses)}</div>
            <div className="card-subtitle">{summary.expenseTransactions} transactions</div>
          </div>

          <div className="summary-card balance">
            <div className="card-header">
              <h3>Net Balance</h3>
              <span className="card-icon">📊</span>
            </div>
            <div className={`card-amount ${summary.balance < 0 ? "negative" : ""}`}>
              {formatCurrency(summary.balance)}
            </div>
            <div className="card-subtitle">Savings Rate: {formatPercentage(summary.savingsRate)}</div>
          </div>

          <div className="summary-card average">
            <div className="card-header">
              <h3>Avg Monthly</h3>
              <span className="card-icon">📈</span>
            </div>
            <div className="card-metrics">
              <div>Income: {formatCurrency(summary.avgMonthlyIncome)}</div>
              <div>Expenses: {formatCurrency(summary.avgMonthlyExpenses)}</div>
            </div>
          </div>
        </div>

        <div className="charts-grid">
          <div className="chart-container">
            <h3>Monthly Income vs Expenses</h3>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="income" fill="#10B981" />
                  <Bar dataKey="expenses" fill="#EF4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-container">
            <h3>Top Expense Categories</h3>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseCategories}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="total"
                    label={({ category, percent }) => `${category}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {expenseCategories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderCategoryAnalysis = () => {
    if (!reportData.categorySpending) return null

    const { categorySpending, topCategories, monthlyTrends } = reportData

    const expenseCategories = categorySpending.filter((cat) => cat.type === "expense")

    // Prepare trend data for top categories
    const trendData = {}
    monthlyTrends?.forEach((trend) => {
      if (!trendData[trend.category]) {
        trendData[trend.category] = []
      }
      trendData[trend.category].push({
        month: `${trend.month_name.substring(0, 3)} ${trend.year}`,
        amount: trend.monthly_total,
      })
    })

    return (
      <div className="report-content">
        <div className="category-overview">
          <h3>Category Spending Overview</h3>
          <div className="category-list">
            {expenseCategories.slice(0, 10).map((category, index) => (
              <div key={category.category} className="category-item">
                <div className="category-info">
                  <div className="category-name">{category.category}</div>
                  <div className="category-stats">
                    {category.transaction_count} transactions • Avg: {formatCurrency(category.avg_amount)}
                  </div>
                </div>
                <div className="category-amount">{formatCurrency(category.total_amount)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="charts-grid">
          <div className="chart-container">
            <h3>Top Categories Distribution</h3>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCategories?.slice(0, 8).filter((cat) => cat.total_spent > 0)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="total_spent" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-container">
            <h3>Spending Percentage by Category</h3>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={topCategories?.slice(0, 8)}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="percentage_of_total"
                    label={({ category, percentage_of_total }) => `${category}: ${percentage_of_total?.toFixed(1)}%`}
                  >
                    {topCategories?.slice(0, 8).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value?.toFixed(1)}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderBudgetPerformance = () => {
    if (!reportData.budgetVsActual) return null

    const { budgetVsActual, summary, historicalPerformance } = reportData

    const budgetChartData = budgetVsActual.map((budget) => ({
      category: budget.category.length > 15 ? budget.category.substring(0, 15) + "..." : budget.category,
      budgeted: budget.monthly_limit,
      spent: budget.actual_spent,
      percentage: budget.usage_percentage,
    }))

    return (
      <div className="report-content">
        <div className="budget-summary">
          <div className="summary-cards">
            <div className="summary-card">
              <h4>Total Budgeted</h4>
              <div className="amount">{formatCurrency(summary.total_budgeted)}</div>
            </div>
            <div className="summary-card">
              <h4>Total Spent</h4>
              <div className="amount">{formatCurrency(summary.total_spent)}</div>
            </div>
            <div className="summary-card">
              <h4>Average Usage</h4>
              <div className="amount">{formatPercentage(summary.avg_usage_percentage)}</div>
            </div>
          </div>
        </div>

        <div className="budget-analysis">
          <h3>Budget vs Actual Spending</h3>
          <div className="budget-items">
            {budgetVsActual.map((budget, index) => (
              <div
                key={budget.id}
                className={`budget-item ${budget.usage_percentage > 100 ? "over-budget" : budget.usage_percentage > 80 ? "warning" : "on-track"}`}
              >
                <div className="budget-header">
                  <h4>{budget.category}</h4>
                  <span className="usage-percentage">{formatPercentage(budget.usage_percentage)}</span>
                </div>
                <div className="budget-progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${Math.min(budget.usage_percentage, 100)}%` }} />
                  </div>
                  <div className="budget-amounts">
                    <span>Spent: {formatCurrency(budget.actual_spent)}</span>
                    <span>Budget: {formatCurrency(budget.monthly_limit)}</span>
                    <span>Remaining: {formatCurrency(budget.remaining)}</span>
                  </div>
                </div>
                <div className="budget-details">{budget.transaction_count} transactions this month</div>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-container">
          <h3>Budget vs Spending Comparison</h3>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={budgetChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="budgeted" fill="#10B981" name="Budgeted" />
                <Bar dataKey="spent" fill="#EF4444" name="Spent" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    )
  }

  const renderCashFlow = () => {
    if (!reportData.monthlyCashFlow) return null

    const { monthlyCashFlow, weeklyCashFlow, summary } = reportData

    const monthlyData = monthlyCashFlow.map((month) => ({
      period: `${month.month_name.substring(0, 3)} ${month.year}`,
      income: month.income,
      expenses: month.expenses,
      netFlow: month.net_cash_flow,
    }))

    const weeklyData =
      weeklyCashFlow?.map((week) => ({
        period: `Week ${week.week_number}`,
        income: week.weekly_income,
        expenses: week.weekly_expenses,
        netFlow: week.weekly_net_flow,
      })) || []

    return (
      <div className="report-content">
        <div className="cash-flow-summary">
          <div className="summary-cards">
            <div className="summary-card income">
              <h4>Total Cash Inflow</h4>
              <div className="amount">{formatCurrency(summary.total_income)}</div>
              <div className="subtitle">{summary.income_transactions} transactions</div>
            </div>
            <div className="summary-card expense">
              <h4>Total Cash Outflow</h4>
              <div className="amount">{formatCurrency(summary.total_expenses)}</div>
              <div className="subtitle">{summary.expense_transactions} transactions</div>
            </div>
            <div className="summary-card balance">
              <h4>Net Cash Flow</h4>
              <div className={`amount ${summary.net_cash_flow < 0 ? "negative" : ""}`}>
                {formatCurrency(summary.net_cash_flow)}
              </div>
            </div>
          </div>
        </div>

        <div className="charts-grid">
          <div className="chart-container">
            <h3>Monthly Cash Flow Trend</h3>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="income" stroke="#10B981" strokeWidth={2} />
                  <Line type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={2} />
                  <Line type="monotone" dataKey="netFlow" stroke="#3B82F6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {weeklyData.length > 0 && (
            <div className="chart-container">
              <h3>Recent Weekly Cash Flow</h3>
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="income" fill="#10B981" />
                    <Bar dataKey="expenses" fill="#EF4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderTrendAnalysis = () => {
    if (!reportData.monthlyTrends) return null

    const { monthlyTrends, categoryTrends, yearOverYear } = reportData

    const trendData = monthlyTrends.map((trend) => ({
      period: `${trend.month_name.substring(0, 3)} ${trend.year}`,
      income: trend.monthly_income,
      expenses: trend.monthly_expenses,
      balance: trend.monthly_balance,
      incomeGrowth: trend.income_growth_rate,
      expenseGrowth: trend.expense_growth_rate,
    }))

    return (
      <div className="report-content">
        <div className="trend-summary">
          <h3>Growth Analysis</h3>
          <div className="growth-metrics">
            {monthlyTrends.slice(-2).map((trend, index) => (
              <div key={index} className="growth-card">
                <h4>
                  {trend.month_name} {trend.year}
                </h4>
                <div className="growth-rates">
                  <div className={`growth-item ${trend.income_growth_rate >= 0 ? "positive" : "negative"}`}>
                    Income Growth: {formatPercentage(trend.income_growth_rate)}
                  </div>
                  <div className={`growth-item ${trend.expense_growth_rate <= 0 ? "positive" : "negative"}`}>
                    Expense Growth: {formatPercentage(trend.expense_growth_rate)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="charts-grid">
          <div className="chart-container">
            <h3>Monthly Trends</h3>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="income" stroke="#10B981" strokeWidth={2} />
                  <Line type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={2} />
                  <Line type="monotone" dataKey="balance" stroke="#3B82F6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {yearOverYear && yearOverYear.length > 1 && (
            <div className="chart-container">
              <h3>Year over Year Comparison</h3>
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearOverYear}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="yearly_income" fill="#10B981" name="Income" />
                    <Bar dataKey="yearly_expenses" fill="#EF4444" name="Expenses" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderComparison = () => {
    if (!reportData.summary) return null

    const { summary, periods, categoryComparison } = reportData

    return (
      <div className="report-content">
        <div className="comparison-header">
          <h3>Period Comparison</h3>
          <div className="periods">
            <span className="current-period">
              {periods.current.monthName} {periods.current.year}
            </span>
            <span className="vs">vs</span>
            <span className="compare-period">
              {periods.comparison.monthName} {periods.comparison.year}
            </span>
          </div>
        </div>

        <div className="comparison-summary">
          <div className="comparison-cards">
            <div className="comparison-card">
              <h4>Income Comparison</h4>
              <div className="amounts">
                <div>Current: {formatCurrency(summary.current.income)}</div>
                <div>Previous: {formatCurrency(summary.comparison.income)}</div>
              </div>
              <div className={`change ${summary.changes.income_change >= 0 ? "positive" : "negative"}`}>
                {summary.changes.income_change >= 0 ? "↑" : "↓"}{" "}
                {formatPercentage(Math.abs(summary.changes.income_change))}
                <br />({formatCurrency(summary.changes.income_absolute_change)})
              </div>
            </div>

            <div className="comparison-card">
              <h4>Expense Comparison</h4>
              <div className="amounts">
                <div>Current: {formatCurrency(summary.current.expenses)}</div>
                <div>Previous: {formatCurrency(summary.comparison.expenses)}</div>
              </div>
              <div className={`change ${summary.changes.expense_change <= 0 ? "positive" : "negative"}`}>
                {summary.changes.expense_change >= 0 ? "↑" : "↓"}{" "}
                {formatPercentage(Math.abs(summary.changes.expense_change))}
                <br />({formatCurrency(summary.changes.expense_absolute_change)})
              </div>
            </div>

            <div className="comparison-card">
              <h4>Balance Change</h4>
              <div className="amounts">
                <div>Current: {formatCurrency(summary.current.balance)}</div>
                <div>Previous: {formatCurrency(summary.comparison.balance)}</div>
              </div>
              <div className={`change ${summary.changes.balance_change >= 0 ? "positive" : "negative"}`}>
                {summary.changes.balance_change >= 0 ? "↑" : "↓"}{" "}
                {formatCurrency(Math.abs(summary.changes.balance_change))}
              </div>
            </div>
          </div>
        </div>

        <div className="category-comparison">
          <h3>Category-wise Comparison</h3>
          <div className="category-comparison-list">
            {categoryComparison?.slice(0, 10).map((category, index) => (
              <div key={category.category} className="category-comparison-item">
                <div className="category-name">{category.category}</div>
                <div className="comparison-data">
                  <div>Current: {formatCurrency(category.current.expense?.total || 0)}</div>
                  <div>Previous: {formatCurrency(category.comparison.expense?.total || 0)}</div>
                  {category.expenseChange !== undefined && (
                    <div className={`change ${category.expenseChange <= 0 ? "positive" : "negative"}`}>
                      {category.expenseChange >= 0 ? "↑" : "↓"} {formatPercentage(Math.abs(category.expenseChange))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const renderReportContent = () => {
    if (loading) {
      return (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Generating {reportTypes.find((r) => r.id === activeReport)?.name}...</p>
        </div>
      )
    }

    if (error) {
      return (
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <p>{error}</p>
          <button onClick={fetchReportData} className="retry-btn">
            Retry
          </button>
        </div>
      )
    }

    if (!reportData || Object.keys(reportData).length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <p>No data available for this report</p>
        </div>
      )
    }

    switch (activeReport) {
      case "financial-summary":
        return renderFinancialSummary()
      case "category-analysis":
        return renderCategoryAnalysis()
      case "budget-performance":
        return renderBudgetPerformance()
      case "cash-flow":
        return renderCashFlow()
      case "trend-analysis":
        return renderTrendAnalysis()
      case "comparison":
        return renderComparison()
      default:
        return <div>Report type not implemented</div>
    }
  }

  if (!user) {
    return (
      <div className="reports-container">
        <div className="error-message">Please log in to view reports.</div>
      </div>
    )
  }

  return (
    <div className="reports-container">
      <div className="reports-header">
        <h2>Financial Reports</h2>
        <p>Comprehensive analysis of your financial data</p>
      </div>

      <div className="reports-navigation">
        {reportTypes.map((report) => (
          <button
            key={report.id}
            className={`report-nav-btn ${activeReport === report.id ? "active" : ""}`}
            onClick={() => setActiveReport(report.id)}
          >
            <span className="report-icon">{report.icon}</span>
            <span className="report-name">{report.name}</span>
          </button>
        ))}
      </div>

      <div className="reports-filters">
        {(activeReport === "financial-summary" ||
          activeReport === "category-analysis" ||
          activeReport === "cash-flow" ||
          activeReport === "trend-analysis") && (
          <div className="filter-section">
            <div className="filter-toggle">
              <button
                className={`toggle-btn ${!dateRange.useRange ? "active" : ""}`}
                onClick={() => !dateRange.useRange || toggleFilterMode()}
              >
                {activeReport === "cash-flow" || activeReport === "trend-analysis" ? "Months" : "Month/Year"}
              </button>
              <button
                className={`toggle-btn ${dateRange.useRange ? "active" : ""}`}
                onClick={() => dateRange.useRange || toggleFilterMode()}
              >
                Date Range
              </button>
            </div>

            {!dateRange.useRange ? (
              activeReport === "cash-flow" || activeReport === "trend-analysis" ? (
                <div className="months-selector">
                  <label>Show last:</label>
                  <select value={monthsToShow} onChange={(e) => setMonthsToShow(Number.parseInt(e.target.value))}>
                    <option value={6}>6 months</option>
                    <option value={12}>12 months</option>
                    <option value={18}>18 months</option>
                    <option value={24}>24 months</option>
                  </select>
                </div>
              ) : (
                <div className="month-year-selector">
                  <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number.parseInt(e.target.value))}>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {new Date(2024, i).toLocaleString("default", { month: "long" })}
                      </option>
                    ))}
                  </select>
                  <select value={selectedYear} onChange={(e) => setSelectedYear(Number.parseInt(e.target.value))}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <option key={2024 + i} value={2024 + i}>
                        {2024 + i}
                      </option>
                    ))}
                  </select>
                </div>
              )
            ) : (
              <div className="date-range-selector">
                <div className="date-input-group">
                  <label>From:</label>
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange((prev) => ({ ...prev, startDate: e.target.value }))}
                    className="date-input"
                  />
                </div>
                <div className="date-input-group">
                  <label>To:</label>
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange((prev) => ({ ...prev, endDate: e.target.value }))}
                    className="date-input"
                  />
                </div>
                {(dateRange.startDate || dateRange.endDate) && (
                  <button className="clear-btn" onClick={clearDateRange}>
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {activeReport === "budget-performance" && (
          <div className="budget-period-selector">
            <label>Budget Period:</label>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number.parseInt(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2024, i).toLocaleString("default", { month: "long" })}
                </option>
              ))}
            </select>
            <select value={selectedYear} onChange={(e) => setSelectedYear(Number.parseInt(e.target.value))}>
              {Array.from({ length: 5 }, (_, i) => (
                <option key={2024 + i} value={2024 + i}>
                  {2024 + i}
                </option>
              ))}
            </select>
          </div>
        )}

        {activeReport === "comparison" && (
          <div className="comparison-period-selector">
            <div className="period-group">
              <label>Current Period:</label>
              <select
                value={comparisonPeriod.currentMonth}
                onChange={(e) =>
                  setComparisonPeriod((prev) => ({ ...prev, currentMonth: Number.parseInt(e.target.value) }))
                }
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(2024, i).toLocaleString("default", { month: "long" })}
                  </option>
                ))}
              </select>
              <select
                value={comparisonPeriod.currentYear}
                onChange={(e) =>
                  setComparisonPeriod((prev) => ({ ...prev, currentYear: Number.parseInt(e.target.value) }))
                }
              >
                {Array.from({ length: 5 }, (_, i) => (
                  <option key={2024 + i} value={2024 + i}>
                    {2024 + i}
                  </option>
                ))}
              </select>
            </div>
            <div className="period-group">
              <label>Compare with:</label>
              <select
                value={comparisonPeriod.compareMonth}
                onChange={(e) =>
                  setComparisonPeriod((prev) => ({ ...prev, compareMonth: Number.parseInt(e.target.value) }))
                }
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(2024, i).toLocaleString("default", { month: "long" })}
                  </option>
                ))}
              </select>
              <select
                value={comparisonPeriod.compareYear}
                onChange={(e) =>
                  setComparisonPeriod((prev) => ({ ...prev, compareYear: Number.parseInt(e.target.value) }))
                }
              >
                {Array.from({ length: 5 }, (_, i) => (
                  <option key={2024 + i} value={2024 + i}>
                    {2024 + i}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="report-main">
        <div className="report-header">
          <h2>
            {reportTypes.find((r) => r.id === activeReport)?.icon}{" "}
            {reportTypes.find((r) => r.id === activeReport)?.name}
          </h2>
          {reportData && Object.keys(reportData).length > 0 && (
            <div className="report-info">
              Generated for {user?.name || "User"} • {new Date().toLocaleDateString()}
              <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button
                  onClick={downloadExcelReport}
                  className="btn-primary"
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: "#10B981",
                    color: "white",
                    border: "none",
                    borderRadius: "0.5rem",
                    cursor: "pointer",
                  }}
                >
                  📊 Download Excel
                </button>
                
              
              </div>
            </div>
          )}
        </div>

        {renderReportContent()}
      </div>
    </div>
  )
}

export default Reports
