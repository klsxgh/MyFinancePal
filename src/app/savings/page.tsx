
"use client";
import type { NextPage } from 'next';
import { useState, type FormEvent, useEffect } from 'react';
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { PiggyBank, PlusCircle, Edit3, Trash2, CheckCircle2, Download, Loader2 } from 'lucide-react';
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
import Image from 'next/image';
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

interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  imageUrl?: string;
  ['data-ai-hint']?: string;
  userId?: string;
  createdAt?: Timestamp;
}

const SavingsGoalsPage: NextPage = () => {
  const { user, isGuest } = useAuth();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);

  const [goalName, setGoalName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [aiHint, setAiHint] = useState('');

  const { toast } = useToast();
  const { selectedCurrency, formatCurrency } = useCurrency();

  useEffect(() => {
    if (!user && !isGuest) {
      setGoals([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    if (user) {
      const goalsCol = collection(db, 'users', user.uid, 'savingsGoals');
      const q = query(goalsCol, orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const userGoals: SavingsGoal[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SavingsGoal));
        setGoals(userGoals);
        setIsLoading(false);
      }, (error) => {
        console.error("Error fetching savings goals: ", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch savings goals." });
        setIsLoading(false);
      });
      return () => unsubscribe();
    } else if (isGuest) {
      const localGoals = JSON.parse(localStorage.getItem('guest-savingsGoals') || '[]');
      setGoals(localGoals);
      setIsLoading(false);
    }
  }, [user, isGuest, toast]);

  const openModalForNew = () => {
    setEditingGoal(null);
    setGoalName('');
    setTargetAmount('');
    setCurrentAmount('0'); 
    setDeadline('');
    setImageUrl('');
    setAiHint('');
    setIsModalOpen(true);
  };

  const openModalForEdit = (goal: SavingsGoal) => {
    setEditingGoal(goal);
    setGoalName(goal.name);
    setTargetAmount(goal.targetAmount.toString());
    setCurrentAmount(goal.currentAmount.toString());
    setDeadline(goal.deadline || '');
    setImageUrl(goal.imageUrl || '');
    setAiHint(goal['data-ai-hint'] || '');
    setIsModalOpen(true);
  };

  const handleSaveGoal = async (e: FormEvent) => {
    e.preventDefault();
    if (!user && !isGuest) {
      toast({ variant: "destructive", title: "Not Authenticated" });
      return;
    }
    if (!goalName || !targetAmount) {
      toast({ variant: "destructive", title: "Missing fields", description: "Goal name and target amount are required." });
      return;
    }

    const targetNum = parseFloat(targetAmount);
    const currentNum = parseFloat(currentAmount || '0'); 

    if (isNaN(targetNum) || targetNum <= 0) {
      toast({ variant: "destructive", title: "Invalid Target Amount" });
      return;
    }
    if (isNaN(currentNum) || currentNum < 0) {
      toast({ variant: "destructive", title: "Invalid Current Amount" });
      return;
    }
     if (currentNum > targetNum) {
      toast({ variant: "destructive", title: "Invalid Amounts", description: "Current amount cannot exceed target amount." });
      return;
    }

    const goalData = {
      name: goalName,
      targetAmount: targetNum,
      currentAmount: currentNum,
      deadline: deadline || null,
      imageUrl: imageUrl || `https://placehold.co/600x400.png`, 
      'data-ai-hint': aiHint || 'saving item', 
    };

    if (user) {
      try {
        if (editingGoal) {
          const goalDocRef = doc(db, 'users', user.uid, 'savingsGoals', editingGoal.id);
          await updateDoc(goalDocRef, { ...goalData, userId: user.uid });
          toast({ title: "Goal Updated" });
        } else {
          await addDoc(collection(db, 'users', user.uid, 'savingsGoals'), { ...goalData, userId: user.uid, createdAt: serverTimestamp() });
          toast({ title: "Goal Added" });
        }
        setIsModalOpen(false);
      } catch (error) {
         console.error("Error saving goal to Firestore: ", error);
         toast({ variant: "destructive", title: "Error Saving Goal" });
      }
    } else if (isGuest) {
        const localGoals = JSON.parse(localStorage.getItem('guest-savingsGoals') || '[]');
        if (editingGoal) {
            const updatedGoals = localGoals.map((g: SavingsGoal) => g.id === editingGoal.id ? { ...g, ...goalData } : g);
            localStorage.setItem('guest-savingsGoals', JSON.stringify(updatedGoals));
            setGoals(updatedGoals);
        } else {
            const newGoal = { ...goalData, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
            const newGoals = [...localGoals, newGoal];
            localStorage.setItem('guest-savingsGoals', JSON.stringify(newGoals));
            setGoals(newGoals);
        }
        toast({ title: editingGoal ? "Goal Updated" : "Goal Added" });
        setIsModalOpen(false);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    if (!user && !isGuest) {
      toast({ variant: "destructive", title: "Not Authenticated" });
      return;
    }

    if (user) {
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'savingsGoals', id));
          toast({ title: "Goal Removed" });
        } catch (error) {
           console.error("Error deleting goal from Firestore: ", error);
           toast({ variant: "destructive", title: "Error Deleting Goal" });
        }
    } else if (isGuest) {
        let localGoals = JSON.parse(localStorage.getItem('guest-savingsGoals') || '[]');
        localGoals = localGoals.filter((g: SavingsGoal) => g.id !== id);
        localStorage.setItem('guest-savingsGoals', JSON.stringify(localGoals));
        setGoals(localGoals);
        toast({ title: "Goal Removed" });
    }
  };

  const getProgressPercentage = (current: number, target: number) => {
    if (target === 0) return 0;
    return Math.min((current / target) * 100, 100);
  };

  const convertToCSV = (data: SavingsGoal[]) => {
    const header = `ID,Name,Target Amount (${selectedCurrency.code}),Current Amount (${selectedCurrency.code}),Deadline,Image URL,AI Hint\n`;
    const rows = data.map(g =>
      `${g.id},"${g.name.replace(/"/g, '""')}",${g.targetAmount.toFixed(2)},${g.currentAmount.toFixed(2)},${g.deadline || ''},${g.imageUrl || ''},"${g['data-ai-hint'] || ''}"`
    ).join("\n");
    return header + rows;
  };

  const handleExportSavingsCSV = () => {
    if (goals.length === 0) {
      toast({ variant: "destructive", title: "No Data", description: "There are no savings goals to export." });
      return;
    }
    const csvData = convertToCSV(goals);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "savings_goals.csv");
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: "Export Successful", description: "Savings goals downloaded as savings_goals.csv." });
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
        <PageHeader title="Achieve Your Savings Goals" description="Set targets, track progress, and visualize your financial achievements." />
        <Card className="text-center py-12">
          <CardHeader><CardTitle>Please Log In</CardTitle></CardHeader>
          <CardContent><CardDescription>You need to be logged in or in guest mode to manage your savings goals.</CardDescription></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Achieve Your Savings Goals"
        description="Set targets, track progress, and visualize your financial achievements."
      >
        <div className="flex gap-2">
            <Button onClick={handleExportSavingsCSV} variant="outline" disabled={goals.length === 0}>
                <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
            <Button onClick={openModalForNew}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Goal
            </Button>
        </div>
      </PageHeader>

      {goals.length === 0 ? (
         <Card className="text-center py-12">
            <CardHeader>
              <PiggyBank className="mx-auto h-12 w-12 text-muted-foreground" />
              <CardTitle className="mt-4">No Savings Goals Yet</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>What are you saving for? Add your first goal!</CardDescription>
              <Button onClick={openModalForNew} className="mt-4">
                <PlusCircle className="mr-2 h-4 w-4" /> Add First Goal
              </Button>
            </CardContent>
          </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          {goals.map((goal) => {
            const progress = getProgressPercentage(goal.currentAmount, goal.targetAmount);
            const isCompleted = goal.currentAmount >= goal.targetAmount;
            const displayImageUrl = goal.imageUrl || `https://placehold.co/600x400.png`;
            const displayAiHint = goal['data-ai-hint'] || (goal.imageUrl ? 'goal image' : 'abstract saving');

            return (
            <Card key={goal.id} className={`flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300 ${isCompleted ? 'border-green-500' : ''}`}>
              <div className="relative h-48 w-full">
                <Image
                  src={displayImageUrl}
                  alt={goal.name}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  style={{objectFit: 'cover'}}
                  className="rounded-t-lg"
                  data-ai-hint={displayAiHint}
                 />
                 {isCompleted && (
                   <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-t-lg">
                     <CheckCircle2 className="h-16 w-16 text-green-400" />
                   </div>
                 )}
              </div>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className={isCompleted ? 'text-green-600' : ''}>{goal.name} {isCompleted && "(Achieved!)"}</CardTitle>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openModalForEdit(goal)} aria-label="Edit goal">
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button variant="ghost" size="icon" aria-label="Delete goal">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the savings goal: {goal.name}.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteGoal(goal.id)} className="bg-destructive hover:bg-destructive/90">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                  </div>
                </div>
                <CardDescription>
                  Target: {formatCurrency(goal.targetAmount)} | Saved: {formatCurrency(goal.currentAmount)}
                  {goal.deadline && ` | Deadline: ${new Date(goal.deadline + 'T00:00:00').toLocaleDateString()}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow flex flex-col justify-end mt-auto">
                <Progress value={progress} className={`w-full h-3 ${isCompleted ? 'bg-green-500 [&>div]:bg-green-500' : ''}`} />
                <p className="text-xs mt-1 text-muted-foreground">
                  {progress.toFixed(0)}% completed.
                  {!isCompleted && goal.currentAmount < goal.targetAmount && ` ${formatCurrency(goal.targetAmount - goal.currentAmount)} to go!`}
                </p>
              </CardContent>
            </Card>
          );
        })}
        </div>
      )}

      {isModalOpen && (
         <AlertDialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <AlertDialogContent className="sm:max-w-[425px]">
            <AlertDialogHeader>
              <AlertDialogTitle>{editingGoal ? "Edit Savings Goal" : "Add New Savings Goal"}</AlertDialogTitle>
              <AlertDialogDescription>
                {editingGoal ? `Update details for your "${editingGoal.name}" goal.` : "Define your new financial target."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <form id="savings-goal-form" onSubmit={handleSaveGoal} className="space-y-4 py-4">
              <div>
                <Label htmlFor="goal-name">Goal Name</Label>
                <Input id="goal-name" value={goalName} onChange={(e) => setGoalName(e.target.value)} placeholder="e.g., Emergency Fund" required />
              </div>
              <div>
                <Label htmlFor="target-amount">Target Amount ({selectedCurrency.symbol})</Label>
                <Input id="target-amount" type="number" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} placeholder="1000" step="0.01" min="0.01" required />
              </div>
              <div>
                <Label htmlFor="current-amount">Current Amount Saved ({selectedCurrency.symbol})</Label>
                <Input id="current-amount" type="number" value={currentAmount} onChange={(e) => setCurrentAmount(e.target.value)} placeholder="0" step="0.01" min="0" />
              </div>
              <div>
                <Label htmlFor="deadline">Deadline (Optional)</Label>
                <Input id="deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </div>
               <div>
                <Label htmlFor="image-url">Image URL (Optional)</Label>
                <Input id="image-url" type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://placehold.co/600x400.png" />
                 <p className="text-xs text-muted-foreground mt-1">If blank, a placeholder image will be used.</p>
              </div>
              <div>
                <Label htmlFor="ai-hint">Image AI Hint (Optional, max 2 words)</Label>
                <Input id="ai-hint" type="text" value={aiHint} onChange={(e) => setAiHint(e.target.value)} placeholder="e.g., travel beach" />
                 <p className="text-xs text-muted-foreground mt-1">Keywords for image search if a placeholder is used, or to describe your custom image.</p>
              </div>
              </form>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setIsModalOpen(false)}>Cancel</AlertDialogCancel>
                <Button type="submit" form="savings-goal-form">{editingGoal ? "Save Changes" : "Add Goal"}</Button>
              </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};

export default SavingsGoalsPage;
