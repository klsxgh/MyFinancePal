
"use client";
import type { NextPage } from 'next';
import { useState, type FormEvent, useEffect } from 'react';
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Edit3, PlusCircle, Trash2, Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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
import { useCurrency } from '@/contexts/CurrencyContext';
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
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

interface Budget {
  id: string;
  category: string;
  allocatedAmount: number;
  spentAmount: number; // This remains a placeholder unless specifically requested to be calculated
  userId?: string;
  createdAt?: Timestamp;
}

const BudgetCategories = ["Groceries", "Utilities", "Dining Out", "Transportation", "Entertainment", "Shopping", "Travel", "Personal Care", "Education", "Gifts", "Rent/Mortgage", "Healthcare", "Other"];

const BudgetsPage: NextPage = () => {
  const { user, isGuest } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [category, setCategory] = useState('');
  const [allocatedAmount, setAllocatedAmount] = useState('');
  const { toast } = useToast();
  const { selectedCurrency, formatCurrency } = useCurrency();

  useEffect(() => {
    if (!user && !isGuest) {
      setBudgets([]);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);

    if (user) {
      const budgetsCol = collection(db, 'users', user.uid, 'budgets');
      const q = query(budgetsCol, orderBy('category'));
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const userBudgets: Budget[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Budget));
        setBudgets(userBudgets);
        setIsLoading(false);
      }, (error) => {
        console.error("Error fetching budgets: ", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch budgets." });
        setIsLoading(false);
      });
      return () => unsubscribe();
    } else if (isGuest) {
        const localBudgets = JSON.parse(localStorage.getItem('guest-budgets') || '[]');
        setBudgets(localBudgets);
        setIsLoading(false);
    }
  }, [user, isGuest, toast]);

  const openModalForNew = () => {
    setEditingBudget(null);
    setCategory('');
    setAllocatedAmount('');
    setIsModalOpen(true);
  };

  const openModalForEdit = (budget: Budget) => {
    setEditingBudget(budget);
    setCategory(budget.category);
    setAllocatedAmount(budget.allocatedAmount.toString());
    setIsModalOpen(true);
  };

  const handleSaveBudget = async (e: FormEvent) => {
    e.preventDefault();
    if (!user && !isGuest) {
      toast({ variant: "destructive", title: "Not Authenticated", description: "You must be logged in or in guest mode." });
      return;
    }
    if (!category || !allocatedAmount) {
      toast({ variant: "destructive", title: "Missing fields", description: "Please select a category and enter an amount." });
      return;
    }

    const amountNum = parseFloat(allocatedAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({ variant: "destructive", title: "Invalid Amount", description: "Please enter a valid positive amount." });
      return;
    }

    if (user) {
        const budgetData = {
          category,
          allocatedAmount: amountNum,
          spentAmount: editingBudget ? editingBudget.spentAmount : 0,
          userId: user.uid,
        };
        try {
            if (editingBudget) {
              const budgetDocRef = doc(db, 'users', user.uid, 'budgets', editingBudget.id);
              await updateDoc(budgetDocRef, budgetData);
              toast({ title: "Budget Updated", description: `Budget for ${category} updated.` });
            } else {
              if (budgets.find(b => b.category === category)) {
                toast({ variant: "destructive", title: "Category Exists", description: `A budget for ${category} already exists.` });
                return;
              }
              await addDoc(collection(db, 'users', user.uid, 'budgets'), { ...budgetData, createdAt: serverTimestamp() });
              toast({ title: "Budget Added", description: `Budget for ${category} set.` });
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error("Error saving budget to Firestore: ", error);
            toast({ variant: "destructive", title: "Error Saving Budget", description: "Could not save budget." });
        }
    } else if (isGuest) {
        const localBudgets = JSON.parse(localStorage.getItem('guest-budgets') || '[]');
        if (editingBudget) {
            const updatedBudgets = localBudgets.map((b: Budget) => b.id === editingBudget.id ? { ...b, category, allocatedAmount: amountNum } : b);
            localStorage.setItem('guest-budgets', JSON.stringify(updatedBudgets));
            setBudgets(updatedBudgets);
            toast({ title: "Budget Updated", description: `Budget for ${category} updated.` });
        } else {
            if (localBudgets.find((b: Budget) => b.category === category)) {
                toast({ variant: "destructive", title: "Category Exists", description: `A budget for ${category} already exists.` });
                return;
            }
            const newBudget: Budget = {
                id: crypto.randomUUID(),
                category,
                allocatedAmount: amountNum,
                spentAmount: 0,
                createdAt: Timestamp.now(),
            };
            const newBudgets = [...localBudgets, newBudget];
            localStorage.setItem('guest-budgets', JSON.stringify(newBudgets));
            setBudgets(newBudgets);
            toast({ title: "Budget Added", description: `Budget for ${category} set.` });
        }
        setIsModalOpen(false);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    if (!user && !isGuest) {
      toast({ variant: "destructive", title: "Not Authenticated" });
      return;
    }

    if (user) {
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'budgets', id));
          toast({ title: "Budget Removed", description: "The selected budget has been removed." });
        } catch (error) {
          console.error("Error deleting budget from Firestore: ", error);
          toast({ variant: "destructive", title: "Error", description: "Could not delete budget." });
        }
    } else if (isGuest) {
        let localBudgets = JSON.parse(localStorage.getItem('guest-budgets') || '[]');
        localBudgets = localBudgets.filter((b: Budget) => b.id !== id);
        localStorage.setItem('guest-budgets', JSON.stringify(localBudgets));
        setBudgets(localBudgets);
        toast({ title: "Budget Removed", description: "The selected budget has been removed." });
    }
  };

  const getProgressPercentage = (spent: number, allocated: number) => {
    if (allocated === 0) return 0;
    return Math.min((spent / allocated) * 100, 100);
  };
  
  const convertToCSV = (data: Budget[]) => {
    const header = `ID,Category,Allocated Amount (${selectedCurrency.code}),Spent Amount (${selectedCurrency.code})\n`;
    const rows = data.map(b =>
      `${b.id},${b.category},${b.allocatedAmount.toFixed(2)},${b.spentAmount.toFixed(2)}`
    ).join("\n");
    return header + rows;
  };

  const handleExportBudgetsCSV = () => {
    if (budgets.length === 0) {
      toast({ variant: "destructive", title: "No Data", description: "There are no budgets to export." });
      return;
    }
    const csvData = convertToCSV(budgets);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "budgets.csv");
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: "Export Successful", description: "Budgets downloaded as budgets.csv." });
    }
  };
  
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
        <PageHeader title="Manage Your Budgets" description="Set spending limits for different categories to stay on track." />
        <Card className="text-center py-12">
          <CardHeader><CardTitle>Please Log In</CardTitle></CardHeader>
          <CardContent><CardDescription>You need to be logged in or in guest mode to manage your budgets.</CardDescription></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Manage Your Budgets"
        description="Set spending limits for different categories to stay on track."
      >
        <div className="flex gap-2">
            <Button onClick={handleExportBudgetsCSV} variant="outline" disabled={budgets.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
            <Button onClick={openModalForNew}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Budget
            </Button>
        </div>
      </PageHeader>

      {budgets.length === 0 ? (
         <Card className="text-center py-12">
            <CardHeader>
              <DollarSign className="mx-auto h-12 w-12 text-muted-foreground" />
              <CardTitle className="mt-4">No Budgets Yet</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Start by adding a new budget for a category.</CardDescription>
              <Button onClick={openModalForNew} className="mt-4">
                <PlusCircle className="mr-2 h-4 w-4" /> Add First Budget
              </Button>
            </CardContent>
          </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget) => (
            <Card key={budget.id} className="flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{budget.category}</CardTitle>
                    <CardDescription>
                      Allocated: {formatCurrency(budget.allocatedAmount)} | Spent: {formatCurrency(budget.spentAmount)}
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openModalForEdit(budget)} aria-label="Edit budget">
                      <Edit3 className="h-4 w-4" />
                    </Button>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button variant="ghost" size="icon" aria-label="Delete budget">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the budget for {budget.category}.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteBudget(budget.id)} className="bg-destructive hover:bg-destructive/90">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-grow flex flex-col justify-end">
                <Progress value={getProgressPercentage(budget.spentAmount, budget.allocatedAmount)} className="w-full h-3" />
                <p className={`text-xs mt-1 ${budget.spentAmount > budget.allocatedAmount ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {budget.spentAmount > budget.allocatedAmount
                    ? `Over budget by ${formatCurrency(budget.spentAmount - budget.allocatedAmount)}`
                    : `${formatCurrency(budget.allocatedAmount - budget.spentAmount)} remaining`
                  }
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isModalOpen && (
         <AlertDialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{editingBudget ? "Edit Budget" : "Add New Budget"}</AlertDialogTitle>
                <AlertDialogDescription>
                  {editingBudget ? `Update details for ${editingBudget.category}.` : "Select a category and set an allocated amount."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <form id="budget-form" onSubmit={handleSaveBudget} className="space-y-4 py-4">
                <div>
                  <Label htmlFor="budget-category">Category</Label>
                  <Select value={category} onValueChange={setCategory} required disabled={!!editingBudget}>
                    <SelectTrigger id="budget-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {BudgetCategories.map(cat => (
                        <SelectItem key={cat} value={cat} disabled={!editingBudget && !!budgets.find(b => b.category === cat)}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="budget-amount">Allocated Amount ({selectedCurrency.symbol})</Label>
                  <Input id="budget-amount" type="number" value={allocatedAmount} onChange={(e) => setAllocatedAmount(e.target.value)} placeholder="0.00" step="0.01" min="0.01" required />
                </div>
              </form>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setIsModalOpen(false)}>Cancel</AlertDialogCancel>
                <Button type="submit" form="budget-form"> 
                  {editingBudget ? "Save Changes" : "Add Budget"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
      )}
    </div>
  );
};

export default BudgetsPage;
