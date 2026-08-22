'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useTodayData } from './useTodayData';

type TodayDataValue = ReturnType<typeof useTodayData>;

const TodayDataContext = createContext<TodayDataValue | null>(null);

/**
 * One shared load of today's data for the whole app.
 *
 * The dashboard and the floating quick-add both need it, and before this they
 * each ran their own copy of a fifteen-query load. Sharing it also means an
 * entry made from the floating button updates the dashboard immediately,
 * without a refetch.
 */
export function TodayDataProvider({ children }: { children: ReactNode }) {
  const value = useTodayData();
  return <TodayDataContext.Provider value={value}>{children}</TodayDataContext.Provider>;
}

export function useTodayContext(): TodayDataValue {
  const context = useContext(TodayDataContext);
  if (!context) throw new Error('useTodayContext muss innerhalb von TodayDataProvider verwendet werden');
  return context;
}
