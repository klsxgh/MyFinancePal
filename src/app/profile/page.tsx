
"use client";

import { useEffect, useState, useRef } from 'react';
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCurrency, availableCurrencies } from '@/contexts/CurrencyContext';
import { UserCircle, Settings, Palette, Globe, UploadCloud, DownloadCloud, AlertTriangle, TrendingDown, TrendingUp, Mail, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import JSZip from 'jszip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/firebase';
import { collection, query, onSnapshot, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';


const APP_DATA_VERSION = "1.0.0"; 

interface ExpenseData {
  amount: number;
  category: string;
  // Consider making IncomeCategories accessible here or pass as prop if needed for more robust income detection
}
const IncomeCategories = ["Salary", "Bonus", "Investment", "Freelance", "Other Income"];

export default function ProfilePage() {
  const [mounted, setMounted] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('light');
  const { selectedCurrency, setSelectedCurrency, formatCurrency } = useCurrency();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
  const [fileToRestore, setFileToRestore] = useState<File | null>(null);

  const { user, isGuest } = useAuth();
  const [totalSpent, setTotalSpent] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);

  const [isResetDataConfirmOpen, setIsResetDataConfirmOpen] = useState(false);
  const [isResettingData, setIsResettingData] = useState(false);

  useEffect(() => {
    setMounted(true);
    const storedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setCurrentTheme(storedTheme);
    document.documentElement.classList.toggle('dark', storedTheme === 'dark');
  }, []);

  useEffect(() => {
    if (!user && !isGuest) {
        setIsLoadingSummary(false);
        setTotalSpent(0);
        setTotalEarned(0);
        return;
    }

    setIsLoadingSummary(true);

    if (user) {
      const expensesCol = collection(db, 'users', user.uid, 'expenses');
      const q = query(expensesCol);
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        let spent = 0;
        let earned = 0;
        querySnapshot.forEach((docSnap) => {
          const expense = docSnap.data() as ExpenseData;
          if (IncomeCategories.includes(expense.category)) { 
            earned += expense.amount;
          } else {
            spent += expense.amount;
          }
        });
        setTotalSpent(spent);
        setTotalEarned(earned);
        setIsLoadingSummary(false);
      }, (error) => {
        console.error("Error fetching expense summary: ", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch expense summary." });
        setIsLoadingSummary(false);
      });
      return () => unsubscribe();
    } else if (isGuest) {
        const localExpenses: ExpenseData[] = JSON.parse(localStorage.getItem('guest-expenses') || '[]');
        let spent = 0;
        let earned = 0;
        localExpenses.forEach(expense => {
            if (IncomeCategories.includes(expense.category)) {
                earned += expense.amount;
            } else {
                spent += expense.amount;
            }
        });
        setTotalSpent(spent);
        setTotalEarned(earned);
        setIsLoadingSummary(false);
    }
  }, [user, isGuest, toast]);

  const toggleTheme = () => {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setCurrentTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const handleCurrencyChange = (currencyCode: string) => {
    const newCurrency = availableCurrencies.find(c => c.code === currencyCode);
    if (newCurrency) {
      setSelectedCurrency(newCurrency);
    }
  };

  const handleBackupData = async () => {
    try {
      const currentSelectedCurrency = localStorage.getItem('selectedCurrency') || selectedCurrency.code;
      const theme = localStorage.getItem('theme') || currentTheme;

      const backupData: any = {
        backupVersion: APP_DATA_VERSION,
        backupDate: new Date().toISOString(),
        settings: {
          selectedCurrency: currentSelectedCurrency,
          theme: theme,
        },
      };

      if (isGuest) {
        backupData.financialData = {
            expenses: JSON.parse(localStorage.getItem('guest-expenses') || '[]'),
            budgets: JSON.parse(localStorage.getItem('guest-budgets') || '[]'),
            savingsGoals: JSON.parse(localStorage.getItem('guest-savingsGoals') || '[]'),
            bankAccounts: JSON.parse(localStorage.getItem('guest-bankAccounts') || '[]'),
        };
      }
      
      const zip = new JSZip();
      const fileName = isGuest ? 'my-finance-pal-guest-backup.json' : 'my-finance-pal-local-settings-backup.json';
      zip.file(fileName, JSON.stringify(backupData, null, 2));
      
      const content = await zip.generateAsync({ type: "blob" });
      
      const link = document.createElement("a");
      const dateSuffix = new Date().toISOString().split('T')[0];
      link.download = `my-finance-pal-backup-${dateSuffix}.zip`;
      link.href = URL.createObjectURL(content);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      toast({ title: "Backup Successful", description: isGuest ? "Your local data has been downloaded." : "Your local settings have been downloaded." });
    } catch (error) {
      console.error("Backup error:", error);
      toast({ variant: "destructive", title: "Backup Failed", description: "Could not create backup file." });
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileToRestore(file);
      setIsRestoreConfirmOpen(true);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const confirmRestoreData = async () => {
    if (!fileToRestore) return;

    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(fileToRestore);
      const jsonFile = contents.file(/my-finance-pal-(guest-backup|local-settings-backup)\.json$/)[0];

      if (!jsonFile) {
        throw new Error("Backup file is missing the required JSON file.");
      }

      const jsonDataString = await jsonFile.async("string");
      const restoredData = JSON.parse(jsonDataString);

      if (!restoredData.backupVersion || !restoredData.settings) {
        throw new Error("Invalid backup file format.");
      }
      
      // Restore settings for both guest and logged-in users
      localStorage.setItem('selectedCurrency', restoredData.settings.selectedCurrency || availableCurrencies[0].code);
      localStorage.setItem('theme', restoredData.settings.theme || 'light');

      // Restore financial data ONLY for guests
      if (isGuest && restoredData.financialData) {
        localStorage.setItem('guest-expenses', JSON.stringify(restoredData.financialData.expenses || []));
        localStorage.setItem('guest-budgets', JSON.stringify(restoredData.financialData.budgets || []));
        localStorage.setItem('guest-savingsGoals', JSON.stringify(restoredData.financialData.savingsGoals || []));
        localStorage.setItem('guest-bankAccounts', JSON.stringify(restoredData.financialData.bankAccounts || []));
      }
      
      toast({ title: "Restore Successful!", description: "Data from backup applied. The page will now reload." });
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (error) {
      console.error("Restore error:", error);
      toast({ variant: "destructive", title: "Restore Failed", description: error instanceof Error ? error.message : "Could not read or apply backup file." });
    } finally {
      setIsRestoreConfirmOpen(false);
      setFileToRestore(null);
    }
  };

  const deleteCollectionContents = async (collectionName: string) => {
    if (!user?.uid) return;
    const collectionRef = collection(db, 'users', user.uid, collectionName);
    const querySnapshot = await getDocs(collectionRef);
    const deletePromises: Promise<void>[] = [];
    querySnapshot.forEach((docSnap) => {
      deletePromises.push(deleteDoc(doc(db, 'users', user.uid, collectionName, docSnap.id)));
    });
    await Promise.all(deletePromises);
  };

  const handleResetAllData = async () => {
    if (!user && !isGuest) {
      toast({ variant: "destructive", title: "Not Authenticated" });
      return;
    }
    setIsResettingData(true);
    try {
      if (user) {
        await deleteCollectionContents('expenses');
        await deleteCollectionContents('budgets');
        await deleteCollectionContents('savingsGoals');
        await deleteCollectionContents('bankAccounts');
        toast({ title: "Cloud Data Reset", description: "All your financial data has been deleted from Firebase." });
      } else if (isGuest) {
        localStorage.removeItem('guest-expenses');
        localStorage.removeItem('guest-budgets');
        localStorage.removeItem('guest-savingsGoals');
        localStorage.removeItem('guest-bankAccounts');
        toast({ title: "Local Data Reset", description: "All your guest data has been cleared from this browser." });
      }
      setTotalSpent(0);
      setTotalEarned(0);
    } catch (error) {
      console.error("Error resetting data: ", error);
      toast({ variant: "destructive", title: "Data Reset Failed" });
    } finally {
      setIsResettingData(false);
      setIsResetDataConfirmOpen(false);
    }
  };

  const showContent = user || isGuest;

  if (!mounted) {
    return null; // Avoid hydration errors
  }

  return (
    <div>
      <PageHeader
        title="Profile & Settings"
        description="Manage your profile information and application settings."
      />
      <div className="space-y-8">
        {!showContent ? (
             <Card>
                <CardHeader><CardTitle>Please Log In</CardTitle></CardHeader>
                <CardContent><CardDescription>Log in or use guest mode to access settings.</CardDescription></CardContent>
            </Card>
        ) : (
        <>
            <Card>
            <CardHeader>
                <CardTitle className="flex items-center">
                <UserCircle className="mr-2 h-5 w-5 text-primary" />
                User Summary
                </CardTitle>
                <CardDescription>
                A quick overview of your financial activity.
                {isGuest && <span className="font-semibold text-primary"> (Guest Mode: Data stored locally)</span>}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoadingSummary ? (
                <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                        <Mail className="h-5 w-5 text-muted-foreground" /> 
                        <Skeleton className="h-5 w-48" />
                    </div>
                    <div className="flex items-center space-x-2">
                        <TrendingUp className="h-5 w-5 text-green-500" /> 
                        <Skeleton className="h-5 w-32" />
                    </div>
                    <div className="flex items-center space-x-2">
                        <TrendingDown className="h-5 w-5 text-red-500" />
                        <Skeleton className="h-5 w-32" />
                    </div>
                </div>
                ) : (
                <>
                    {user?.email && (
                    <div className="flex items-center space-x-2">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm font-medium">{user.email}</span>
                    </div>
                    )}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-6 space-y-2 sm:space-y-0">
                        <div className="flex items-center space-x-2">
                            <TrendingUp className="h-5 w-5 text-green-500" />
                            <span className="text-sm">Total Earned:</span>
                            <Badge variant="outline" className="text-green-600 border-green-500">
                                {formatCurrency(totalEarned)}
                            </Badge>
                        </div>
                        <div className="flex items-center space-x-2">
                            <TrendingDown className="h-5 w-5 text-red-500" />
                            <span className="text-sm">Total Spent:</span>
                            <Badge variant="outline" className="text-red-600 border-red-500">
                                {formatCurrency(totalSpent)}
                            </Badge>
                        </div>
                    </div>
                </>
                )}
            </CardContent>
            </Card>

            <Card>
            <CardHeader>
                <CardTitle className="flex items-center">
                <Settings className="mr-2 h-5 w-5 text-primary" />
                Application Settings
                </CardTitle>
                <CardDescription>
                Customize your experience with My Finance Pal.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center">
                    <Palette className="mr-3 h-5 w-5 text-muted-foreground" />
                    <div>
                    <Label htmlFor="theme-toggle" className="font-medium">Dark Mode</Label>
                    <p className="text-xs text-muted-foreground">Toggle between light and dark themes.</p>
                    </div>
                </div>
                <Switch
                    id="theme-toggle"
                    checked={currentTheme === 'dark'}
                    onCheckedChange={toggleTheme}
                    aria-label="Toggle dark mode"
                />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center">
                    <Globe className="mr-3 h-5 w-5 text-muted-foreground" />
                    <div>
                    <Label htmlFor="currency-select" className="font-medium">Display Currency</Label>
                    <p className="text-xs text-muted-foreground">Choose your preferred currency for display.</p>
                    </div>
                </div>
                <Select value={selectedCurrency.code} onValueChange={handleCurrencyChange}>
                    <SelectTrigger id="currency-select" className="w-[180px]">
                    <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                    {availableCurrencies.map(currency => (
                        <SelectItem key={currency.code} value={currency.code}>
                        {currency.symbol} - {currency.name} ({currency.code})
                        </SelectItem>
                    ))}
                    </SelectContent>
                </Select>
                </div>
            </CardContent>
            </Card>

            <Card>
            <CardHeader>
                <CardTitle className="flex items-center">
                    <UploadCloud className="mr-2 h-5 w-5 text-primary" />
                    Data Management
                </CardTitle>
                <CardDescription>
                    Backup your data to a file or restore from a backup.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <Label className="font-medium">Backup Data</Label>
                            <p className="text-xs text-muted-foreground">
                                {isGuest ? "Download all your local guest data to a zip file." : "Download your local theme and currency preferences."}
                            </p>
                        </div>
                        <Button onClick={handleBackupData} variant="outline">
                            <DownloadCloud className="mr-2 h-4 w-4" /> Backup Data
                        </Button>
                    </div>
                </div>
                
                <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <Label htmlFor="restore-file-input" className="font-medium">Restore Data</Label>
                            <p className="text-xs text-muted-foreground">
                                Upload a backup file to restore your data.
                                {isGuest ? " This will overwrite your current guest data." : " This will restore local settings."}
                            </p>
                        </div>
                        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                            <UploadCloud className="mr-2 h-4 w-4" /> Choose Backup
                        </Button>
                        <Input 
                            id="restore-file-input"
                            type="file" 
                            accept=".zip"
                            className="hidden" 
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                        />
                    </div>
                </div>
            </CardContent>
            </Card>

            <Card className="border-destructive">
                <CardHeader>
                    <CardTitle className="flex items-center text-destructive">
                        <AlertTriangle className="mr-2 h-5 w-5" />
                        Danger Zone
                    </CardTitle>
                    <CardDescription>
                        Irreversible actions that will permanently alter your application data.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="p-4 border border-destructive/50 rounded-lg bg-destructive/5">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                                <Label className="font-medium text-destructive">Reset All Application Data</Label>
                                <p className="text-xs text-destructive/80 mt-1">
                                    This will permanently delete all your financial data from {isGuest ? "this browser" : "Firebase"}. 
                                    This action cannot be undone.
                                </p>
                            </div>
                            <Button 
                                variant="destructive" 
                                onClick={() => setIsResetDataConfirmOpen(true)} 
                                disabled={isResettingData}
                                className="w-full sm:w-auto flex-shrink-0"
                            >
                                {isResettingData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                Reset All Data
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </>
        )}
      </div>

      <AlertDialog open={isRestoreConfirmOpen} onOpenChange={setIsRestoreConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
                <UploadCloud className="mr-2 h-5 w-5 text-primary" />
                Confirm Data Restore
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore data from the selected backup file? 
              This will overwrite your current {isGuest ? "local guest data" : "local settings"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setIsRestoreConfirmOpen(false); setFileToRestore(null); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestoreData} >
              Overwrite and Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isResetDataConfirmOpen} onOpenChange={setIsResetDataConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center text-destructive">
                <AlertTriangle className="mr-2 h-5 w-5" />
                Are you absolutely sure?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action will **permanently delete all your financial data** from {isGuest ? "this browser's local storage" : "your Firebase account"}. This action **cannot be undone**.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Button variant="outline" onClick={handleBackupData} className="w-full">
                <DownloadCloud className="mr-2 h-4 w-4" /> Backup Data Now
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResettingData}>Cancel</AlertDialogCancel>
            <Button
                variant="destructive"
                onClick={handleResetAllData}
                disabled={isResettingData}
            >
                {isResettingData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Yes, Delete All My Data
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
