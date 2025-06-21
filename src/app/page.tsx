
"use client";

import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import PageHeader from '@/components/shared/page-header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Receipt, Target, PiggyBank, BarChartBig, Landmark, UserCircle, PieChart as PieChartIcon, Activity, TrendingDown, TrendingUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrency } from '@/contexts/CurrencyContext';
import { db } from '@/firebase';
import { collection, query, onSnapshot, where, Timestamp } from 'firebase/firestore';
import { PieChart as RechartsPieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface ExpenseDoc {
  id: string;
  date: string; // YYYY-MM-DD string
  category: string;
  amount: number;
  description?: string;
}

interface CategoryBreakdown {
  name: string;
  value: number;
  fill: string;
}

const IncomeCategories = ["Salary", "Bonus", "Investment", "Freelance", "Other Income"];

const PIE_CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--primary))",
  "hsl(var(--accent))",
];

const features = [
  {
    title: 'Track Expenses',
    description: 'Log and categorize your daily, weekly, and monthly spending.',
    href: '/expenses',
    icon: Receipt,
    cta: 'Log Expenses',
  },
  {
    title: 'Set Budgets',
    description: 'Create budgets for different categories to control your spending.',
    href: '/budgets',
    icon: Target,
    cta: 'Manage Budgets',
  },
  {
    title: 'Savings Goals',
    description: 'Define your savings goals and track your progress towards them.',
    href: '/savings',
    icon: PiggyBank,
    cta: 'Set Goals',
  },
  {
    title: 'Bank Accounts',
    description: 'View and manage your linked bank account balances and transactions.',
    href: '/bank-accounts',
    icon: Landmark,
    cta: 'View Accounts',
  },
  {
    title: 'Financial Reports',
    description: 'Visualize spending and get financial summaries.',
    href: '/reports',
    icon: BarChartBig,
    cta: 'View Reports',
  },
];

export default function DashboardPage() {
  const { user, isGuest } = useAuth();
  const { formatCurrency } = useCurrency();
  const [expenses, setExpenses] = useState<ExpenseDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let unsubscribe = () => {};
    if (user?.uid || isGuest) {
      setIsLoading(true);

      if (user?.uid) {
        const today = new Date();
        const firstDayCurrentMonth = startOfMonth(today);
        const lastDayCurrentMonth = endOfMonth(today);
        const expensesCol = collection(db, 'users', user.uid, 'expenses');
        const q = query(expensesCol,
          where('date', '>=', format(firstDayCurrentMonth, 'yyyy-MM-dd')),
          where('date', '<=', format(lastDayCurrentMonth, 'yyyy-MM-dd'))
        );
        unsubscribe = onSnapshot(q, (querySnapshot) => {
          const userEntries: ExpenseDoc[] = [];
          querySnapshot.forEach((docSnap) => {
            userEntries.push({ id: docSnap.id, ...docSnap.data() } as ExpenseDoc);
          });
          setExpenses(userEntries);
          setIsLoading(false);
        }, (error) => {
          console.error("Error fetching entries for dashboard: ", error);
          setIsLoading(false);
        });
      } else if (isGuest) {
        const localExpensesRaw = localStorage.getItem('guest-expenses');
        const allLocalExpenses = localExpensesRaw ? JSON.parse(localExpensesRaw) : [];
        setExpenses(allLocalExpenses);
        setIsLoading(false);
      }
    } else {
      setExpenses([]);
      setIsLoading(false);
    }
    return () => unsubscribe();
  }, [user, isGuest]);

  const {
    expenseCategoryBreakdown,
    totalExpensesCurrentMonth,
    totalIncomeCurrentMonth,
    expenseTransactionCountCurrentMonth
  } = useMemo(() => {
    const today = new Date();
    const currentMonthEntries = expenses.filter(entry => {
        try {
            const entryDate = parseISO(entry.date);
            return isWithinInterval(entryDate, { start: startOfMonth(today), end: endOfMonth(today) });
        } catch (e) {
            console.warn(`Invalid date format for entry ID ${entry.id}: ${entry.date}`);
            return false;
        }
    });

    const breakdown: { [key: string]: number } = {};
    let currentMonthTotalExpenses = 0;
    let currentMonthTotalIncome = 0;
    let currentMonthExpenseTransactions = 0;

    currentMonthEntries.forEach(entry => {
      if (IncomeCategories.includes(entry.category)) {
        currentMonthTotalIncome += entry.amount;
      } else {
        breakdown[entry.category] = (breakdown[entry.category] || 0) + entry.amount;
        currentMonthTotalExpenses += entry.amount;
        currentMonthExpenseTransactions++;
      }
    });

    const chartData: CategoryBreakdown[] = Object.entries(breakdown)
      .map(([name, value], index) => ({
        name,
        value,
        fill: PIE_CHART_COLORS[index % PIE_CHART_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);

    return {
        expenseCategoryBreakdown: chartData,
        totalExpensesCurrentMonth: currentMonthTotalExpenses,
        totalIncomeCurrentMonth: currentMonthTotalIncome,
        expenseTransactionCountCurrentMonth: currentMonthExpenseTransactions
    };
  }, [expenses]);

  const showDashboard = user || isGuest;

  return (
    <div className="container mx-auto">
      <PageHeader
        title="Welcome to My Finance Pal"
        description="Your personal dashboard for managing finances and achieving goals."
      >
        {user && (
            <Button asChild variant="outline" size="icon">
                <Link href="/profile" aria-label="View Profile and Settings">
                    <UserCircle className="h-5 w-5" />
                </Link>
            </Button>
        )}
      </PageHeader>

      {isLoading && showDashboard && (
        <Card className="mb-8 shadow-lg">
          <CardHeader>
            <Skeleton className="h-7 w-1/2" />
            <Skeleton className="h-4 w-3/4 mt-1" />
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-6 items-center">
            <div className="flex justify-center items-center h-[250px] md:h-[300px]">
              <Skeleton className="h-48 w-48 md:h-60 md:w-60 rounded-full" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-10 w-full md:w-1/2" />
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && showDashboard && (
        <Card className="mb-8 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl flex items-center">
                <PieChartIcon className="mr-2 h-6 w-6 text-primary" />
                This Month's Financial Snapshot
            </CardTitle>
            <CardDescription>
              A quick overview of your finances for {format(new Date(), 'MMMM yyyy')}.
              {isGuest && <span className="text-primary font-semibold"> (Guest Mode)</span>}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {expenses.length === 0 ? (
              <p className="text-muted-foreground text-center py-10">
                No financial entries logged for the current month. <Link href="/expenses" className="text-primary hover:underline">Add some entries</Link> to see your snapshot!
              </p>
            ) : (
              <div className="grid md:grid-cols-2 gap-6 items-center">
                <div className="flex justify-center items-center h-[250px] md:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={expenseCategoryBreakdown}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={window.innerWidth < 768 ? 80 : 110}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {expenseCategoryBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} stroke={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number, name: string) => [formatCurrency(value), name]}/>
                      <Legend iconSize={10} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center text-sm text-muted-foreground mb-1">
                        <TrendingUp className="mr-2 h-4 w-4 text-green-500" />
                        Total Income This Month
                    </div>
                    <p className="text-3xl font-bold text-green-600">
                        {formatCurrency(totalIncomeCurrentMonth)}
                    </p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center text-sm text-muted-foreground mb-1">
                        <TrendingDown className="mr-2 h-4 w-4 text-red-500" />
                        Total Expenses This Month
                    </div>
                    <p className="text-3xl font-bold text-red-600">
                        {formatCurrency(totalExpensesCurrentMonth)}
                    </p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center text-sm text-muted-foreground mb-1">
                        <Activity className="mr-2 h-4 w-4" />
                        Expense Transactions This Month
                    </div>
                    <p className="text-3xl font-bold">
                        {expenseTransactionCountCurrentMonth}
                    </p>
                  </div>
                   <Button asChild variant="outline" className="w-full sm:w-auto">
                    <Link href="/reports">
                      View Full Reports
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

       {!isLoading && !showDashboard && (
        <Card className="mb-8 text-center py-12 shadow-lg">
            <CardHeader>
                <CardTitle>Welcome to My Finance Pal!</CardTitle>
            </CardHeader>
            <CardContent>
                <CardDescription className="mb-4">Log in or sign up to start managing your finances and see your personalized dashboard.</CardDescription>
                <div className="flex gap-2 justify-center">
                    <Button asChild>
                        <Link href="/login">Log In</Link>
                    </Button>
                    <Button asChild variant="outline">
                        <Link href="/signup">Sign Up</Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
       )}


      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
        {features.map((feature) => (
          <Card key={feature.title} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="flex flex-row items-start gap-4 pb-4">
                <div className="p-3 rounded-md bg-primary/10 text-primary">
                    <feature.icon className="w-6 h-6" />
                </div>
                <div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                    <CardDescription className="mt-1">{feature.description}</CardDescription>
                </div>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href={feature.href}>
                  {feature.cta}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
