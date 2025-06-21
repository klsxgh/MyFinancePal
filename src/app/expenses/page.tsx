
"use client";

import type { NextPage } from 'next';
import { useState, type FormEvent, useEffect, useRef, useMemo } from 'react';
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Trash2, Download, Loader2, FilterX, Landmark, Edit, XCircle, RefreshCcw, TrendingUp, TrendingDown, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/firebase';
import {
  collection,
  addDoc,
  doc,
  deleteDoc,
  updateDoc,
  query,
  onSnapshot,
  Timestamp,
  orderBy,
  serverTimestamp,
  where,
} from 'firebase/firestore';

interface Expense {
  id: string;
  date: string;
  time?: string;
  category: string;
  amount: number;
  description: string;
  bankAccountId?: string | null;
  isRecurring?: boolean;
  recurrenceFrequency?: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
  recurrenceEndDate?: string | null;
  createdAt?: Timestamp | string;
  userId?: string;
}

interface BankAccount {
  id: string;
  name: string;
  startingBalance: number;
  color: string;
  userId?: string;
  createdAt?: Timestamp | string;
}

const ExpenseCategories = ["Groceries", "Utilities", "Rent/Mortgage", "Transportation", "Entertainment", "Healthcare", "Dining Out", "Education", "Shopping", "Travel", "Gifts", "Subscriptions", "Other"];
export const IncomeCategories = ["Salary", "Bonus", "Investment", "Freelance", "Other Income"];
const AllCategories = Array.from(new Set([...ExpenseCategories, ...IncomeCategories]));


const RecurrenceFrequencies: { value: 'daily' | 'weekly' | 'monthly' | 'yearly'; label: string }[] = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
];

const ALL_FILTER_CATEGORIES_VALUE = "__ALL_FILTER_CATEGORIES__";
const NO_ACCOUNT_SELECTED_VALUE = "__NO_ACCOUNT__";
const ALL_ACCOUNTS_FILTER_VALUE = "__ALL_ACCOUNTS_FILTER__";


const predefinedBankColors: { name: string; class: string }[] = [
  { name: 'Red', class: 'bg-red-500' }, { name: 'Orange', class: 'bg-orange-500' },
  { name: 'Amber', class: 'bg-amber-500' }, { name: 'Yellow', class: 'bg-yellow-500' },
  { name: 'Lime', class: 'bg-lime-500' }, { name: 'Green', class: 'bg-green-500' },
  { name: 'Emerald', class: 'bg-emerald-500' }, { name: 'Teal', class: 'bg-teal-500' },
  { name: 'Cyan', class: 'bg-cyan-500' }, { name: 'Sky', class: 'bg-sky-500' },
  { name: 'Blue', class: 'bg-blue-500' }, { name: 'Indigo', class: 'bg-indigo-500' },
  { name: 'Violet', class: 'bg-violet-500' }, { name: 'Purple', class: 'bg-purple-500' },
  { name: 'Fuchsia', class: 'bg-fuchsia-500' }, { name: 'Pink', class: 'bg-pink-500' },
  { name: 'Rose', class: 'bg-rose-500' }, { name: 'Slate', class: 'bg-slate-500' },
];


const ExpensesPage: NextPage = () => {
  const { user, isGuest } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [formType, setFormType] = useState<'income' | 'expense' | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string | undefined>(undefined);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const [isRecurringForm, setIsRecurringForm] = useState(false);
  const [recurrenceFrequencyForm, setRecurrenceFrequencyForm] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [recurrenceEndDateForm, setRecurrenceEndDateForm] = useState('');

  const { toast } = useToast();
  const { selectedCurrency, formatCurrency } = useCurrency();

  const [isBankAccountModalOpen, setIsBankAccountModalOpen] = useState(false);
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountStartBalance, setBankAccountStartBalance] = useState('');
  const [bankAccountColor, setBankAccountColor] = useState(predefinedBankColors[0].class);

  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDescription, setFilterDescription] = useState('');
  const [filterBankAccountId, setFilterBankAccountId] = useState<string | undefined>(undefined);

  useEffect(() => {
    let unsubExpenses = () => {};
    let unsubAccounts = () => {};

    if (!user && !isGuest) {
      setExpenses([]);
      setBankAccounts([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    if (user) {
      const expensesCol = collection(db, 'users', user.uid, 'expenses');
      const qExpenses = query(expensesCol, orderBy('date', 'desc'), orderBy('createdAt', 'desc'));
      unsubExpenses = onSnapshot(qExpenses, (querySnapshot) => {
        const userExpenses = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
        setExpenses(userExpenses);
      }, (error) => {
        console.error("Error fetching expenses: ", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch expenses. Check console for details, possibly an index is required." });
      });

      const accountsCol = collection(db, 'users', user.uid, 'bankAccounts');
      const qAccounts = query(accountsCol, orderBy('name'));
      unsubAccounts = onSnapshot(qAccounts, (querySnapshot) => {
        const userAccounts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankAccount));
        setBankAccounts(userAccounts);
        setIsLoading(false);
      }, (error) => {
        console.error("Error fetching bank accounts: ", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch bank accounts. Check console." });
        setIsLoading(false);
      });

    } else if (isGuest) {
        const localExpenses = JSON.parse(localStorage.getItem('guest-expenses') || '[]');
        const localAccounts = JSON.parse(localStorage.getItem('guest-bankAccounts') || '[]');
        setExpenses(localExpenses);
        setBankAccounts(localAccounts);
        setIsLoading(false);
    }
    
    return () => {
      unsubExpenses();
      unsubAccounts();
    };
  }, [user, isGuest, toast]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      const expenseDateOnly = new Date(expense.date);
      if (filterStartDate) {
        const localExpenseDate = new Date(expenseDateOnly.getFullYear(), expenseDateOnly.getMonth(), expenseDateOnly.getDate());
        if (localExpenseDate < new Date(new Date(filterStartDate).getFullYear(), new Date(filterStartDate).getMonth(), new Date(filterStartDate).getDate())) return false;
      }
      if (filterEndDate) {
         const localExpenseDate = new Date(expenseDateOnly.getFullYear(), expenseDateOnly.getMonth(), expenseDateOnly.getDate());
        if (localExpenseDate > new Date(new Date(filterEndDate).getFullYear(), new Date(filterEndDate).getMonth(), new Date(filterEndDate).getDate())) return false;
      }
      if (filterCategory && expense.category !== filterCategory) return false;
      if (filterDescription && !expense.description.toLowerCase().includes(filterDescription.toLowerCase())) return false;

      if (filterBankAccountId === NO_ACCOUNT_SELECTED_VALUE && expense.bankAccountId) return false;
      if (filterBankAccountId && filterBankAccountId !== NO_ACCOUNT_SELECTED_VALUE && expense.bankAccountId !== filterBankAccountId && filterBankAccountId !== ALL_ACCOUNTS_FILTER_VALUE) return false;

      return true;
    }).sort((a,b) => {
        const getMillis = (dateObj: any) => {
          if (!dateObj) return 0;
          if (dateObj.toMillis) return dateObj.toMillis();
          if (typeof dateObj === 'string') return new Date(dateObj).getTime();
          return 0;
        }

        const dateA = new Date(`${a.date}T${a.time || '00:00:00Z'}`);
        const dateB = new Date(`${b.date}T${b.time || '00:00:00Z'}`);
        if (dateA.getTime() !== dateB.getTime()) {
            return dateB.getTime() - dateA.getTime();
        }
        
        const createdAtA = getMillis(a.createdAt);
        const createdAtB = getMillis(b.createdAt);
        if (createdAtA && createdAtB) {
          return createdAtB - createdAtA;
        }
        return 0;
    });
  }, [expenses, filterStartDate, filterEndDate, filterCategory, filterDescription, filterBankAccountId]);

  const resetFormFields = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setTime('');
    setCategory('');
    setAmount('');
    setDescription('');
    setSelectedBankAccountId(undefined);
    setEditingExpense(null);
    setIsRecurringForm(false);
    setRecurrenceFrequencyForm('monthly');
    setRecurrenceEndDateForm('');
  }

  const handleSetFormType = (type: 'income' | 'expense' | null) => {
    resetFormFields();
    setFormType(type);
    if (type === 'income') {
      setCategory('Salary');
    }
  };

  const handleSaveExpense = async (e: FormEvent) => {
    e.preventDefault();
    if (!user && !isGuest) {
      toast({ variant: "destructive", title: "Not Authenticated", description: "You must be logged in or in guest mode to save." });
      return;
    }

    let currentCategory = category;
    if (formType === 'income' && !IncomeCategories.includes(category) && !editingExpense) {
      currentCategory = 'Salary';
    } else if (formType === 'income' && editingExpense && !IncomeCategories.includes(category)) {
      currentCategory = 'Salary';
    } else if (formType === 'expense' && !category && !editingExpense) {
        toast({ variant: "destructive", title: "Missing fields", description: "Please select a category for the expense." });
        return;
    }


    if (!date || !currentCategory || !amount) {
      toast({ variant: "destructive", title: "Missing fields", description: "Please fill in date, category, and amount." });
      return;
    }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
        toast({ variant: "destructive", title: "Invalid Amount", description: "Please enter a valid positive amount." });
        return;
    }

    const expenseDataToSave = {
        date,
        time: time || undefined,
        category: currentCategory,
        amount: amountNum,
        description: description || "",
        bankAccountId: (selectedBankAccountId && selectedBankAccountId !== NO_ACCOUNT_SELECTED_VALUE) ? selectedBankAccountId : null,
        isRecurring: isRecurringForm,
        recurrenceFrequency: isRecurringForm ? recurrenceFrequencyForm : null,
        recurrenceEndDate: isRecurringForm && recurrenceEndDateForm ? recurrenceEndDateForm : null,
    };

    if (user) {
        try {
          if (editingExpense) {
              const expenseDocRef = doc(db, 'users', user.uid, 'expenses', editingExpense.id);
              await updateDoc(expenseDocRef, { ...expenseDataToSave, userId: user.uid });
              toast({ title: "Entry Updated", description: `${currentCategory} of ${formatCurrency(amountNum)} updated.` });
          } else {
              await addDoc(collection(db, 'users', user.uid, 'expenses'), {
                ...expenseDataToSave,
                userId: user.uid,
                createdAt: serverTimestamp(),
              });
              toast({ title: `${formType === 'income' ? 'Income' : 'Expense'} Added`, description: `${currentCategory} of ${formatCurrency(amountNum)} logged.` });
          }
          handleSetFormType(null);
        } catch (error) {
            console.error("Error saving expense/income: ", error);
            const firebaseError = error as { code?: string; message: string };
            toast({ variant: "destructive", title: `Error Saving (${firebaseError.code || 'Unknown'})`, description: firebaseError.message || "Could not save entry. Check console for details." });
        }
    } else if (isGuest) {
        const localExpenses: Expense[] = JSON.parse(localStorage.getItem('guest-expenses') || '[]');
        if (editingExpense) {
            const updatedExpenses = localExpenses.map(exp => exp.id === editingExpense.id ? { ...exp, ...expenseDataToSave, id: exp.id, createdAt: exp.createdAt } : exp);
            localStorage.setItem('guest-expenses', JSON.stringify(updatedExpenses));
            setExpenses(updatedExpenses);
        } else {
            const newExpense = { ...expenseDataToSave, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
            const newExpenses = [...localExpenses, newExpense];
            localStorage.setItem('guest-expenses', JSON.stringify(newExpenses));
            setExpenses(newExpenses);
        }
        toast({ title: editingExpense ? "Entry Updated" : `${formType === 'income' ? 'Income' : 'Expense'} Added` });
        handleSetFormType(null);
    }
  };

  const handleEditExpense = (expenseToEdit: Expense) => {
    setEditingExpense(expenseToEdit);
    setDate(expenseToEdit.date);
    setTime(expenseToEdit.time || '');
    setCategory(expenseToEdit.category);
    setAmount(expenseToEdit.amount.toString());
    setDescription(expenseToEdit.description || '');
    setSelectedBankAccountId(expenseToEdit.bankAccountId || undefined);
    setIsRecurringForm(expenseToEdit.isRecurring || false);
    setRecurrenceFrequencyForm(expenseToEdit.recurrenceFrequency || 'monthly');
    setRecurrenceEndDateForm(expenseToEdit.recurrenceEndDate || '');

    if (IncomeCategories.includes(expenseToEdit.category)) {
      setFormType('income');
    } else {
      setFormType('expense');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteExpense = async (id: string) => {
    if (!user && !isGuest) {
      toast({ variant: "destructive", title: "Not Authenticated", description: "You must be logged in or in guest mode." });
      return;
    }
    if (user) {
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'expenses', id));
          toast({ title: "Entry Removed", description: "The selected entry has been removed." });
        } catch (error) {
          console.error("Error deleting entry: ", error);
          toast({ variant: "destructive", title: "Error", description: "Could not delete entry." });
        }
    } else if (isGuest) {
        let localExpenses = JSON.parse(localStorage.getItem('guest-expenses') || '[]');
        localExpenses = localExpenses.filter((exp: Expense) => exp.id !== id);
        localStorage.setItem('guest-expenses', JSON.stringify(localExpenses));
        setExpenses(localExpenses);
        toast({ title: "Entry Removed" });
    }
  };

  const handleAddBankAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (!user && !isGuest) {
      toast({ variant: "destructive", title: "Not Authenticated" });
      return;
    }
    if (!bankAccountName || !bankAccountStartBalance || !bankAccountColor) {
        toast({ variant: "destructive", title: "Missing fields", description: "Please provide name, starting balance, and color." });
        return;
    }
    const balanceNum = parseFloat(bankAccountStartBalance);
    if (isNaN(balanceNum) || balanceNum < 0) {
        toast({ variant: "destructive", title: "Invalid Balance", description: "Enter a valid non-negative starting balance." });
        return;
    }
    const newAccountData = {
        name: bankAccountName,
        startingBalance: balanceNum,
        color: bankAccountColor,
    };

    if (user) {
        try {
          await addDoc(collection(db, 'users', user.uid, 'bankAccounts'), {...newAccountData, userId: user.uid, createdAt: serverTimestamp()});
          toast({ title: "Bank Account Added", description: `Account "${bankAccountName}" created.` });
        } catch (error) {
          console.error("Error adding bank account: ", error);
          toast({ variant: "destructive", title: "Error Adding Account" });
        }
    } else if (isGuest) {
        const localAccounts = JSON.parse(localStorage.getItem('guest-bankAccounts') || '[]');
        const newAccount = { ...newAccountData, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
        const newAccounts = [...localAccounts, newAccount];
        localStorage.setItem('guest-bankAccounts', JSON.stringify(newAccounts));
        setBankAccounts(newAccounts);
        toast({ title: "Bank Account Added", description: `Account "${bankAccountName}" created locally.` });
    }
    setBankAccountName('');
    setBankAccountStartBalance('');
    setBankAccountColor(predefinedBankColors[0].class);
  };

  const handleDeleteBankAccount = async (id: string) => {
    if (!user && !isGuest) {
      toast({ variant: "destructive", title: "Not Authenticated" });
      return;
    }
    if (user) {
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'bankAccounts', id));
          toast({ title: "Bank Account Removed" });
        } catch (error) {
          console.error("Error deleting bank account: ", error);
          toast({ variant: "destructive", title: "Error Deleting Account" });
        }
    } else if (isGuest) {
        let localAccounts = JSON.parse(localStorage.getItem('guest-bankAccounts') || '[]');
        localAccounts = localAccounts.filter((acc: BankAccount) => acc.id !== id);
        localStorage.setItem('guest-bankAccounts', JSON.stringify(localAccounts));
        setBankAccounts(localAccounts);
        toast({ title: "Bank Account Removed" });
    }
  };

  const convertToCSV = (data: Expense[]) => {
    const header = `ID,Date,Time,Category,Amount (${selectedCurrency.code}),Description,Bank Account Name,Is Recurring,Recurrence Frequency,Recurrence End Date\n`;
    const rows = data.map(exp => {
      const bankAccount = bankAccounts.find(ba => ba.id === exp.bankAccountId);
      return [
        exp.id,
        exp.date,
        exp.time || '',
        exp.category,
        exp.amount.toFixed(2),
        `"${(exp.description || '').replace(/"/g, '""')}"`,
        bankAccount ? bankAccount.name : '',
        exp.isRecurring ? 'Yes' : 'No',
        exp.recurrenceFrequency || '',
        exp.recurrenceEndDate || '',
      ].join(",");
    }).join("\n");
    return header + rows;
  };

  const handleExportExpensesCSV = () => {
    if (filteredExpenses.length === 0) {
      toast({ variant: "destructive", title: "No Data", description: "No entries (matching filters) to export." });
      return;
    }
    const csvData = convertToCSV(filteredExpenses);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "financial_entries.csv");
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: "Export Successful", description: "Filtered entries downloaded as financial_entries.csv." });
    }
  };

  const clearFilters = () => {
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterCategory('');
    setFilterDescription('');
    setFilterBankAccountId(undefined);
  };

  const currentCategoryList = formType === 'income' ? IncomeCategories : ExpenseCategories;
  const showContent = user || isGuest;

  if (isLoading) {
     return (
        <div className="flex justify-center items-center h-screen">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  if (!showContent) {
    return (
      <div>
        <PageHeader title="Track Your Finances" description="Log your income and expenses to understand your financial habits." />
        <Card className="text-center py-12">
          <CardHeader><CardTitle>Please Log In</CardTitle></CardHeader>
          <CardContent><CardDescription>You need to be logged in or in guest mode to track your finances.</CardDescription></CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div>
      <PageHeader
        title="Track Your Finances"
        description="Log your income and expenses to understand your financial habits."
      >
        <div className="flex gap-2">
            <Button onClick={() => setIsBankAccountModalOpen(true)} variant="outline">
                <Landmark className="mr-2 h-4 w-4" /> Manage Bank Accounts
            </Button>
            <Button onClick={handleExportExpensesCSV} variant="outline" disabled={expenses.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
        </div>
      </PageHeader>
      
      <div className="space-y-8">
        {!formType ? (
          <Card>
            <CardHeader>
              <CardTitle>What would you like to log?</CardTitle>
              <CardDescription>Choose to log an income or an expense transaction.</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
              <Card
                className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleSetFormType('income')}
              >
                <div className="flex flex-col items-center text-center">
                  <TrendingUp className="h-12 w-12 text-green-500 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Log Income</h3>
                  <p className="text-sm text-muted-foreground">Record money you've earned or received.</p>
                </div>
              </Card>
              <Card
                className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleSetFormType('expense')}
              >
                <div className="flex flex-col items-center text-center">
                  <TrendingDown className="h-12 w-12 text-red-500 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Log Expense</h3>
                  <p className="text-sm text-muted-foreground">Track money you've spent.</p>
                </div>
              </Card>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                  <CardTitle>
                      {editingExpense ? `Edit ${IncomeCategories.includes(editingExpense.category) ? 'Income' : 'Expense'}` : (formType === 'income' ? 'Log New Income' : 'Log New Expense')}
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => handleSetFormType(null)}>
                      <ArrowLeft className="mr-2 h-4 w-4" /> Back to choices
                  </Button>
              </div>
              <CardDescription>
                  {editingExpense ? "Update the details of your entry." : `Enter the details of your ${formType} below.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form id="expense-form" onSubmit={handleSaveExpense} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                      <Label htmlFor="date">Date / Start Date</Label>
                      <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                  </div>
                  <div>
                      <Label htmlFor="time">Time (Optional)</Label>
                      <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                      <Label htmlFor="category">Category</Label>
                      <Select
                          value={category}
                          onValueChange={(value) => setCategory(value as string)}
                          required={formType === 'expense' || (formType === 'income' && !!editingExpense) }
                          disabled={formType === 'income' && !editingExpense && category === 'Salary'}
                      >
                      <SelectTrigger id="category">
                          <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                          {currentCategoryList.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                      </SelectContent>
                      </Select>
                       {formType === 'income' && !editingExpense && <p className="text-xs text-muted-foreground mt-1">Default category set to Salary for new income.</p>}
                  </div>
                  <div>
                      <Label htmlFor="bankAccount">Bank Account (Optional)</Label>
                      <Select
                          value={selectedBankAccountId || NO_ACCOUNT_SELECTED_VALUE}
                          onValueChange={(value) => setSelectedBankAccountId(value === NO_ACCOUNT_SELECTED_VALUE ? undefined : value)}
                      >
                          <SelectTrigger id="bankAccount">
                              <SelectValue placeholder="Select bank account" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value={NO_ACCOUNT_SELECTED_VALUE}>No specific account</SelectItem>
                              {bankAccounts.map(acc => (
                                  <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="amount">Amount ({selectedCurrency.symbol})</Label>
                  <Input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" step="0.01" min="0.01" required />
                </div>
                <div>
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Input id="description" type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g., Weekly groceries" />
                </div>

                <div className="space-y-2 pt-2 border-t mt-4">
                   <div className="flex items-center space-x-2">
                      <Checkbox id="isRecurring" checked={isRecurringForm} onCheckedChange={(checked) => setIsRecurringForm(checked as boolean)} />
                      <Label htmlFor="isRecurring" className="font-medium">Is this a recurring entry?</Label>
                   </div>
                  {isRecurringForm && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 pl-2 border-l ml-2">
                          <div>
                              <Label htmlFor="recurrenceFrequency">Frequency</Label>
                               <Select
                                  value={recurrenceFrequencyForm}
                                  onValueChange={(value) => setRecurrenceFrequencyForm(value as 'daily' | 'weekly' | 'monthly' | 'yearly')}
                              >
                                  <SelectTrigger id="recurrenceFrequency"><SelectValue placeholder="Select frequency" /></SelectTrigger>
                                  <SelectContent>
                                      {RecurrenceFrequencies.map(freq => (
                                          <SelectItem key={freq.value} value={freq.value}>{freq.label}</SelectItem>
                                      ))}
                                  </SelectContent>
                              </Select>
                          </div>
                          <div>
                              <Label htmlFor="recurrenceEndDate">End Date (Optional)</Label>
                              <Input id="recurrenceEndDate" type="date" value={recurrenceEndDateForm} onChange={(e) => setRecurrenceEndDateForm(e.target.value)} min={date} />
                          </div>
                      </div>
                  )}
                </div>
              </form>
                <div className="flex flex-col sm:flex-row gap-2 pt-4">
                  <Button type="submit" form="expense-form" className="flex-1">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {editingExpense ? `Update ${IncomeCategories.includes(editingExpense.category) ? 'Income' : 'Expense'}` : (formType === 'income' ? 'Add Income' : 'Add Expense')}
                  </Button>
                  {(editingExpense || formType) && (
                      <Button type="button" variant="outline" onClick={() => handleSetFormType(null)} className="flex-1">
                          <XCircle className="mr-2 h-4 w-4" /> Cancel
                      </Button>
                  )}
                </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Recent Financial Entries</CardTitle>
            <CardDescription>A list of your logged income and expenses. Use filters to narrow down the results.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 mb-6 p-4 border rounded-lg">
              <h4 className="font-medium">Filter Entries</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <Label htmlFor="filter-start-date">Start Date</Label>
                  <Input id="filter-start-date" type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="filter-end-date">End Date</Label>
                  <Input id="filter-end-date" type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="filter-category">Category</Label>
                  <Select
                    value={filterCategory || ALL_FILTER_CATEGORIES_VALUE}
                    onValueChange={(value) => setFilterCategory(value === ALL_FILTER_CATEGORIES_VALUE ? '' : value)}
                  >
                    <SelectTrigger id="filter-category"><SelectValue placeholder="All Categories" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_FILTER_CATEGORIES_VALUE}>All Categories</SelectItem>
                      {AllCategories.map(cat => (
                        <SelectItem key={`filter-cat-${cat}`} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="lg:col-span-2">
                  <Label htmlFor="filter-description">Description</Label>
                  <Input id="filter-description" type="text" value={filterDescription} onChange={(e) => setFilterDescription(e.target.value)} placeholder="Search description..." />
                </div>
                 <div>
                    <Label htmlFor="filter-bankAccount">Bank Account</Label>
                    <Select
                        value={filterBankAccountId || ALL_ACCOUNTS_FILTER_VALUE}
                        onValueChange={(value) => setFilterBankAccountId(value)}
                    >
                        <SelectTrigger id="filter-bankAccount"><SelectValue placeholder="All Accounts" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_ACCOUNTS_FILTER_VALUE}>All Accounts</SelectItem>
                            <SelectItem value={NO_ACCOUNT_SELECTED_VALUE}>No Specific Account (Entries)</SelectItem>
                            {bankAccounts.map(acc => (
                                <SelectItem key={`filter-acc-${acc.id}`} value={acc.id}>{acc.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <Button onClick={clearFilters} variant="outline" size="sm">
                  <FilterX className="mr-2 h-4 w-4" /> Clear Filters
                </Button>
              </div>
            </div>

            <Separator className="mb-6"/>

            {expenses.length === 0 && !editingExpense && !formType ? (
              <p className="text-muted-foreground text-center py-8">No financial entries yet. Choose 'Log Income' or 'Log Expense' above to start!</p>
            ) : filteredExpenses.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No entries match your current filters.</p>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Date</TableHead>
                    <TableHead className="w-[80px]">Time</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="w-[120px]">Amount</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[150px]">Bank Account</TableHead>
                    <TableHead className="w-[100px]">Recurring</TableHead>
                    <TableHead className="text-right w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.slice(0, 10).map((exp) => {
                    const bankAccount = bankAccounts.find(ba => ba.id === exp.bankAccountId);
                    const isIncome = IncomeCategories.includes(exp.category);
                    return (
                        <TableRow key={exp.id}>
                        <TableCell>{new Date(exp.date + 'T00:00:00').toLocaleDateString()}</TableCell>
                        <TableCell>{exp.time || '-'}</TableCell>
                        <TableCell>{exp.category}</TableCell>
                        <TableCell className={isIncome ? 'text-green-600' : 'text-red-600'}>
                          {isIncome ? '+' : '-'} {formatCurrency(exp.amount)}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">{exp.description || '-'}</TableCell>
                        <TableCell>
                            {bankAccount ? (
                                <div className="flex items-center gap-2">
                                <span className={`h-3 w-3 rounded-full ${bankAccount.color}`}></span>
                                {bankAccount.name}
                                </div>
                            ) : (
                                <span className="text-muted-foreground italic">N/A</span>
                            )}
                        </TableCell>
                         <TableCell>
                            {exp.isRecurring ? (
                                <div className="flex items-center gap-1">
                                    <RefreshCcw className="h-4 w-4 text-blue-500" />
                                    <span className="text-xs">
                                        {(exp.recurrenceFrequency ? RecurrenceFrequencies.find(f=>f.value === exp.recurrenceFrequency)?.label : '') || 'Yes'}
                                        {exp.recurrenceEndDate && ` (Ends: ${new Date(exp.recurrenceEndDate + 'T00:00:00').toLocaleDateString()})`}
                                    </span>
                                </div>
                            ) : (
                                "No"
                            )}
                        </TableCell>
                        <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => handleEditExpense(exp)} aria-label="Edit entry">
                                <Edit className="h-4 w-4" />
                            </Button>
                             <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label="Delete entry">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete this entry.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteExpense(exp.id)} className="bg-destructive hover:bg-destructive/90">
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                        </TableCell>
                        </TableRow>
                    );
                })}
                </TableBody>
              </Table>
              </div>
            )}
            {filteredExpenses.length > 10 && (
                <p className="text-muted-foreground text-sm text-center pt-4">
                    Showing the first 10 matching entries. Export to CSV to see all entries.
                </p>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={isBankAccountModalOpen} onOpenChange={setIsBankAccountModalOpen}>
        <AlertDialogContent className="sm:max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Manage Bank Accounts</AlertDialogTitle>
            <AlertDialogDescription>
              Add, view, or remove your bank accounts. Data stored {isGuest ? "locally in your browser" : "in your secure cloud account"}.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <form id="bank-account-form" onSubmit={handleAddBankAccount} className="space-y-4 py-2">
            <h3 className="text-lg font-semibold border-b pb-2">Add New Account</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <Label htmlFor="bankAccountName">Account Name</Label>
                <Input id="bankAccountName" value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} placeholder="e.g., Savings Account" required />
              </div>
              <div>
                <Label htmlFor="bankAccountStartBalance">Starting Balance ({selectedCurrency.symbol})</Label>
                <Input id="bankAccountStartBalance" type="number" value={bankAccountStartBalance} onChange={(e) => setBankAccountStartBalance(e.target.value)} placeholder="0.00" step="0.01" min="0" required />
              </div>
              <div>
                <Label htmlFor="bankAccountColor">Color</Label>
                <Select value={bankAccountColor} onValueChange={setBankAccountColor} required>
                    <SelectTrigger id="bankAccountColor">
                        <div className="flex items-center gap-2">
                            <span className={`h-4 w-4 rounded-full ${bankAccountColor}`}></span>
                            <SelectValue placeholder="Select color" />
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        {predefinedBankColors.map(color => (
                        <SelectItem key={color.class} value={color.class}>
                            <div className="flex items-center gap-2">
                                <span className={`h-4 w-4 rounded-full ${color.class}`}></span>
                                {color.name}
                            </div>
                        </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" form="bank-account-form" size="sm"><PlusCircle className="mr-2 h-4 w-4" />Add Account</Button>
          </form>

          <Separator className="my-4" />

          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
            <h3 className="text-lg font-semibold border-b pb-2 mb-2 sticky top-0 bg-background z-10">Existing Accounts</h3>
            {isLoading && <Loader2 className="h-5 w-5 animate-spin text-primary my-4" />}
            {!isLoading && bankAccounts.length === 0 && <p className="text-muted-foreground text-sm">No bank accounts added yet.</p>}
            {!isLoading && bankAccounts.map(acc => (
              <div key={acc.id} className="flex items-center justify-between p-2 border rounded-md hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <span className={`h-5 w-5 rounded-full ${acc.color}`}></span>
                  <div>
                    <span className="font-medium">{acc.name}</span>
                    <p className="text-xs text-muted-foreground">Starts with: {formatCurrency(acc.startingBalance)}</p>
                  </div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={`Delete ${acc.name}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Bank Account?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete the account "{acc.name}"? This action cannot be undone.
                        Existing expenses linked to this account will remain but will show "N/A" for the bank account.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteBankAccount(acc.id)} className="bg-destructive hover:bg-destructive/90">
                        Delete Account
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>

          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel onClick={() => setIsBankAccountModalOpen(false)}>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default ExpensesPage;
