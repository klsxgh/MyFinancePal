
"use client";

import { useEffect, useState, useMemo } from 'react';
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TrendingUp, PieChart as PieChartLucide, Goal, Loader2 } from 'lucide-react';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Pie, PieChart as RechartsPieChart, Cell, Legend, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts"
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/firebase';
import { collection, query, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { IncomeCategories } from '@/app/expenses/page';

interface ExpenseDoc {
  id: string;
  date: string; 
  category: string;
  amount: number;
  createdAt?: Timestamp;
}

interface BudgetDoc {
  id: string;
  category: string;
  allocatedAmount: number;
}

interface BudgetComparisonData {
  category: string;
  allocated: number;
  spent: number;
}

const barChartConfig = {
  totalExpenses: {
    label: "Total Expenses",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

const budgetChartConfig = {
  allocated: { label: "Allocated", color: "hsl(var(--chart-2))" },
  spent: { label: "Spent", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const PIE_CHART_COLORS = [
  "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--primary))",
  "hsl(var(--accent))",
];

export default function ReportsPage() {
  const { formatCurrency } = useCurrency();
  const { user, isGuest } = useAuth();
  
  const [allExpenses, setAllExpenses] = useState<ExpenseDoc[]>([]);
  const [allBudgets, setAllBudgets] = useState<BudgetDoc[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    let unsubExpenses = () => {};
    let unsubBudgets = () => {};

    if (user || isGuest) {
        setIsLoadingData(true);
        if (user) {
            const expensesCol = collection(db, 'users', user.uid, 'expenses');
            const expensesQuery = query(expensesCol, orderBy('date', 'asc'));
            unsubExpenses = onSnapshot(expensesQuery, (snapshot) => {
                const userExpenses: ExpenseDoc[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExpenseDoc));
                setAllExpenses(userExpenses);
                checkCompletion();
            }, (error) => {
                console.error("Error fetching expenses for reports: ", error);
                checkCompletion();
            });

            const budgetsCol = collection(db, 'users', user.uid, 'budgets');
            const budgetsQuery = query(budgetsCol, orderBy('category'));
            unsubBudgets = onSnapshot(budgetsQuery, (snapshot) => {
                const userBudgets: BudgetDoc[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BudgetDoc));
                setAllBudgets(userBudgets);
                checkCompletion();
            }, (error) => {
                console.error("Error fetching budgets for reports: ", error);
                checkCompletion();
            });
        } else if (isGuest) {
            const localExpenses = JSON.parse(localStorage.getItem('guest-expenses') || '[]');
            const localBudgets = JSON.parse(localStorage.getItem('guest-budgets') || '[]');
            setAllExpenses(localExpenses);
            setAllBudgets(localBudgets);
            setIsLoadingData(false);
        }
    } else {
        setAllExpenses([]);
        setAllBudgets([]);
        setIsLoadingData(false);
    }

    let fetchesCompleted = 0;
    const totalFetches = 2;
    const checkCompletion = () => {
        fetchesCompleted++;
        if (fetchesCompleted >= totalFetches) {
            setIsLoadingData(false);
        }
    };

    return () => {
        unsubExpenses();
        unsubBudgets();
    };
  }, [user, isGuest]);

  const monthlyExpensesData = useMemo(() => {
    const monthlyTotals: { [key: string]: number } = {};
    allExpenses.forEach(expense => {
      if (IncomeCategories.includes(expense.category)) return;
      try {
        const expenseDate = parseISO(expense.date);
        const monthKey = format(expenseDate, 'yyyy-MM');
        monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + expense.amount;
      } catch (e) { console.warn(`Invalid date format for expense ID ${expense.id}: ${expense.date}`); }
    });
    return Object.entries(monthlyTotals)
      .map(([monthKey, total]) => {
        const [year, monthNumStr] = monthKey.split('-');
        const monthNum = parseInt(monthNumStr, 10);
        const dateForMonthName = new Date(parseInt(year), monthNum -1);
        return {
          month: format(dateForMonthName, 'MMM yyyy'),
          monthKey: monthKey,
          totalExpenses: total,
        };
      })
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [allExpenses]);

  const categoryBreakdownChartData = useMemo(() => {
    const today = new Date();
    const firstDayCurrentMonth = startOfMonth(today);
    const lastDayCurrentMonth = endOfMonth(today);

    const currentMonthExpenses = allExpenses.filter(expense => {
      if (IncomeCategories.includes(expense.category)) return false;
      try {
        const expenseDate = parseISO(expense.date);
        return isWithinInterval(expenseDate, { start: firstDayCurrentMonth, end: lastDayCurrentMonth });
      } catch (e) { return false; }
    });

    const breakdown: { [key: string]: number } = {};
    currentMonthExpenses.forEach(expense => {
      breakdown[expense.category] = (breakdown[expense.category] || 0) + expense.amount;
    });

    return Object.entries(breakdown)
      .map(([name, value], index) => ({
        name,
        value,
        fill: PIE_CHART_COLORS[index % PIE_CHART_COLORS.length],
      }))
      .sort((a,b) => b.value - a.value);
  }, [allExpenses]);
  
  const budgetComparisonChartData = useMemo(() => {
    const today = new Date();
    const firstDayCurrentMonth = startOfMonth(today);
    const lastDayCurrentMonth = endOfMonth(today);

    const currentMonthExpenses = allExpenses.filter(expense => {
       if (IncomeCategories.includes(expense.category)) return false;
      try {
        const expenseDate = parseISO(expense.date);
        return isWithinInterval(expenseDate, { start: firstDayCurrentMonth, end: lastDayCurrentMonth });
      } catch (e) { return false; }
    });

    return allBudgets.map(budget => {
      const spentForCategory = currentMonthExpenses
        .filter(expense => expense.category === budget.category)
        .reduce((sum, exp) => sum + exp.amount, 0);
      return {
        category: budget.category,
        allocated: budget.allocatedAmount,
        spent: spentForCategory,
      };
    });
  }, [allBudgets, allExpenses]);
  
  const showContent = user || isGuest;

  if (isLoadingData) {
     return (<div className="flex items-center justify-center h-screen"> <Loader2 className="h-12 w-12 animate-spin text-primary" /> </div>);
  }

  if (!showContent) {
      return (
        <div>
          <PageHeader title="Financial Reports & Insights" description="Visualize your spending patterns and get financial summaries." />
          <Card className="text-center py-12"><CardHeader><CardTitle>Please Log In</CardTitle></CardHeader><CardContent><CardDescription>You need to be logged in or in guest mode to view reports.</CardDescription></CardContent></Card>
        </div>
      );
  }

  return (
    <div>
      <PageHeader
        title="Financial Reports & Insights"
        description="Visualize your spending patterns and get financial summaries."
      />

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="mr-2 h-5 w-5 text-primary" />
              Monthly Expense Trends
            </CardTitle>
            <CardDescription>
              Your total expenses over the past few months.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingData ? (
              <div className="flex items-center justify-center h-[250px]"> <Loader2 className="h-8 w-8 animate-spin text-primary" /> </div>
            ) : monthlyExpensesData.length === 0 ? (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground"> No monthly expense data. Log expenses to see trends. </div>
            ) : (
                <ChartContainer config={barChartConfig} className="min-h-[250px] w-full aspect-video">
                <BarChart accessibilityLayer data={monthlyExpensesData}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrency(value)} />
                    <ChartTooltip 
                        content={<ChartTooltipContent 
                            formatter={(value, name, props) => (
                                <div className="flex flex-col">
                                <span className="text-muted-foreground">{props.payload?.month}</span>
                                <span>{barChartConfig.totalExpenses.label}: {formatCurrency(Number(value))}</span>
                                </div>
                            )}
                        />} 
                    />
                    <Bar dataKey="totalExpenses" fill="var(--color-totalExpenses)" radius={4} />
                </BarChart>
                </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <PieChartLucide className="mr-2 h-5 w-5 text-accent" />
              Expense Breakdown by Category (Current Month)
            </CardTitle>
            <CardDescription>
              Distribution of your expenses for {format(new Date(), 'MMMM yyyy')}.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
             {isLoadingData ? (
                <div className="flex items-center justify-center h-[300px]"> <Loader2 className="h-8 w-8 animate-spin text-primary" /> </div>
            ) : categoryBreakdownChartData.length === 0 ? (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground"> No expenses this month to break down. </div>
            ) : (
                <ResponsiveContainer width="100%" height={300}>
                    <RechartsPieChart>
                        <Pie data={categoryBreakdownChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} labelLine={false} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                            {categoryBreakdownChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} stroke={entry.fill}/>
                            ))}
                        </Pie>
                        <RechartsTooltip formatter={(value: number, name: string) => [formatCurrency(value), name]}/>
                        <Legend iconSize={10} />
                    </RechartsPieChart>
                </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Goal className="mr-2 h-5 w-5 text-primary" />
              Budget vs. Actual Spending (Current Month)
            </CardTitle>
            <CardDescription>
              Comparison for {format(new Date(), 'MMMM yyyy')}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingData ? (
                <div className="flex items-center justify-center h-[300px]"> <Loader2 className="h-8 w-8 animate-spin text-primary" /> </div>
            ) : budgetComparisonChartData.length === 0 ? (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground"> No budgets set. Add budgets to compare. </div>
            ) : (
                <ChartContainer config={budgetChartConfig} className="min-h-[300px] w-full aspect-video">
                <BarChart data={budgetComparisonChartData} layout="horizontal">
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="category" type="category" tickLine={false} axisLine={false} />
                    <YAxis type="number" tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrency(value)} />
                    <ChartTooltip 
                        content={<ChartTooltipContent 
                            formatter={(value, name, props) => {
                                const payloadItem = props.payload as BudgetComparisonData;
                                if (name === 'allocated') {
                                    return `${budgetChartConfig.allocated.label}: ${formatCurrency(payloadItem.allocated)}`;
                                }
                                if (name === 'spent') {
                                     return `${budgetChartConfig.spent.label}: ${formatCurrency(payloadItem.spent)}`;
                                }
                                return `${name}: ${formatCurrency(Number(value))}`;
                            }}
                            itemSorter={(item) => item.name === 'allocated' ? -1 : 1}
                        />} 
                    />
                    <Legend />
                    <Bar dataKey="allocated" fill="var(--color-allocated)" radius={4} name={budgetChartConfig.allocated.label} />
                    <Bar dataKey="spent" fill="var(--color-spent)" radius={4} name={budgetChartConfig.spent.label} />
                </BarChart>
                </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

    