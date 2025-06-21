
"use client";

import type { NextPage } from 'next';
import { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { VenetianMask, Loader2, Landmark } from 'lucide-react'; 
import { useCurrency } from '@/contexts/CurrencyContext';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/firebase';
import {
  collection,
  query,
  onSnapshot,
  Timestamp,
  orderBy,
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';


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
  createdAt?: Timestamp; 
  userId?: string;
}

interface BankAccount {
  id: string;
  name: string;
  startingBalance: number;
  color: string;
  userId?: string;
  createdAt?: Timestamp;
}

const BankAccountsPage: NextPage = () => {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { formatCurrency } = useCurrency();
  const { user, isGuest } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    let unsubAccounts = () => {};
    let unsubExpenses = () => {};

    if (user || isGuest) {
      setIsLoading(true);

      if (user) {
        // Fetch Bank Accounts from Firestore
        const accountsCol = collection(db, 'users', user.uid, 'bankAccounts');
        const qAccounts = query(accountsCol, orderBy('name'));
        unsubAccounts = onSnapshot(qAccounts, (querySnapshot) => {
          const userAccounts: BankAccount[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankAccount));
          setBankAccounts(userAccounts);
        }, (error) => {
          console.error("Error fetching bank accounts: ", error);
          toast({ variant: "destructive", title: "Error", description: "Could not fetch bank accounts." });
        });

        // Fetch Expenses from Firestore
        const expensesCol = collection(db, 'users', user.uid, 'expenses');
        const qExpenses = query(expensesCol);
        unsubExpenses = onSnapshot(qExpenses, (querySnapshot) => {
          const userExpenses: Expense[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
          setExpenses(userExpenses);
          setIsLoading(false);
        }, (error) => {
          console.error("Error fetching expenses: ", error);
          toast({ variant: "destructive", title: "Error", description: "Could not fetch expense data." });
          setIsLoading(false);
        });

      } else if (isGuest) {
        // Fetch from localStorage
        const localAccounts = JSON.parse(localStorage.getItem('guest-bankAccounts') || '[]');
        const localExpenses = JSON.parse(localStorage.getItem('guest-expenses') || '[]');
        setBankAccounts(localAccounts);
        setExpenses(localExpenses);
        setIsLoading(false);
      }
    } else {
      setBankAccounts([]);
      setExpenses([]);
      setIsLoading(false);
    }

    return () => {
      unsubAccounts();
      unsubExpenses();
    };
  }, [user, isGuest, toast]);

  const accountsWithCalculatedBalances = useMemo(() => {
    return bankAccounts.map(account => {
      const accountExpenses = expenses.filter(exp => exp.bankAccountId === account.id);
      const totalDebits = accountExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      const currentBalance = account.startingBalance - totalDebits; 
      
      return {
        ...account,
        totalDebits,
        currentBalance,
        transactions: accountExpenses.sort((a,b) => {
            const dateA = new Date(a.date && a.date.includes('T') ? a.date : `${a.date}T${a.time || '00:00:00'}`);
            const dateB = new Date(b.date && b.date.includes('T') ? b.date : `${b.date}T${b.time || '00:00:00'}`);
            if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0; 
            if (dateA.getTime() !== dateB.getTime()) {
                return dateB.getTime() - dateA.getTime();
            }
            if (a.createdAt && b.createdAt) {
                return b.createdAt.toMillis() - a.createdAt.toMillis();
            }
            return 0;
        }),
      };
    });
  }, [bankAccounts, expenses]);
  
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
        <PageHeader title="Your Bank Accounts" description="Overview of your accounts, balances, and transaction history." />
        <Card className="text-center py-12">
          <CardHeader><CardTitle>Please Log In</CardTitle></CardHeader>
          <CardContent><CardDescription>You need to be logged in or in guest mode to view your bank accounts.</CardDescription></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Your Bank Accounts"
        description="Overview of your accounts, balances, and transaction history."
      >
        <Button asChild variant="outline">
            <Link href="/expenses">
                <Landmark className="mr-2 h-4 w-4" /> Add/Manage Accounts
            </Link>
        </Button>
      </PageHeader>

      {accountsWithCalculatedBalances.length === 0 ? (
        <Card className="text-center py-12 shadow-lg">
          <CardHeader>
            <VenetianMask className="mx-auto h-16 w-16 text-primary" />
            <CardTitle className="mt-4 text-2xl">No Bank Accounts Found</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-lg">
              It looks like you haven&apos;t added any bank accounts yet.
            </CardDescription>
            <p className="mt-2 text-muted-foreground">
              Please go to the <Link href="/expenses" className="text-primary hover:underline">Expenses page</Link> to add your first bank account.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {accountsWithCalculatedBalances.map((account) => (
            <Card key={account.id} className="shadow-lg">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className={`h-6 w-6 rounded-full ${account.color} border-2 border-card`}></span>
                        <CardTitle className="text-xl">{account.name}</CardTitle>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${account.currentBalance >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        Current: {formatCurrency(account.currentBalance)}
                    </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
                    <div className="p-3 bg-muted/50 rounded-md">
                        <p className="text-muted-foreground">Starting Balance</p>
                        <p className="font-semibold text-lg">{formatCurrency(account.startingBalance)}</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-md">
                        <p className="text-muted-foreground">Total Debits (from Expenses)</p>
                        <p className="font-semibold text-lg text-red-600">{formatCurrency(account.totalDebits)}</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-md">
                        <p className="text-muted-foreground">Calculated Balance</p>
                        <p className={`font-semibold text-lg ${account.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(account.currentBalance)}</p>
                    </div>
                </div>

                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value={`transactions-${account.id}`}>
                    <AccordionTrigger className="text-base hover:no-underline">
                        View Transactions ({account.transactions.length})
                    </AccordionTrigger>
                    <AccordionContent>
                      {account.transactions.length === 0 ? (
                        <p className="text-muted-foreground py-4 text-center">No transactions recorded for this account yet.</p>
                      ) : (
                        <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[100px]">Date</TableHead>
                              <TableHead className="w-[80px]">Time</TableHead>
                              <TableHead>Category</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                              <TableHead>Description</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {account.transactions.map((exp) => (
                              <TableRow key={exp.id}>
                                <TableCell>{new Date(exp.date && exp.date.includes('T') ? exp.date : `${exp.date}T00:00:00`).toLocaleDateString()}</TableCell>
                                <TableCell>{exp.time || '-'}</TableCell>
                                <TableCell>{exp.category}</TableCell>
                                <TableCell className="text-right text-red-600">{formatCurrency(exp.amount)}</TableCell>
                                <TableCell className="max-w-[200px] truncate">{exp.description || '-'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default BankAccountsPage;
