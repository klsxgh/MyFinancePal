
"use client";

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import React, { createContext, useContext, useEffect, useState } from 'react';

export interface Currency {
  code: string;
  name: string;
  symbol: string;
}

export const availableCurrencies: Currency[] = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
];

interface CurrencyContextType {
  selectedCurrency: Currency;
  setSelectedCurrency: Dispatch<SetStateAction<Currency>>;
  formatCurrency: (amount: number) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(() => {
    if (typeof window !== 'undefined') {
      const storedCurrencyCode = localStorage.getItem('selectedCurrency');
      const found = availableCurrencies.find(c => c.code === storedCurrencyCode);
      return found || availableCurrencies.find(c => c.code === 'INR')!; // Default to INR
    }
    return availableCurrencies.find(c => c.code === 'INR')!; // Default to INR for SSR
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedCurrency', selectedCurrency.code);
    }
  }, [selectedCurrency]);

  const formatCurrency = (amount: number) => {
    return `${selectedCurrency.symbol}${amount.toFixed(2)}`;
  };

  return (
    <CurrencyContext.Provider value={{ selectedCurrency, setSelectedCurrency, formatCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = (): CurrencyContextType => {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};
