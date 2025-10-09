import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ViewAsContextType {
  viewAsCompanyId: string | null;
  viewAsCompanyName: string | null;
  setViewAsCompany: (companyId: string | null, companyName: string | null) => void;
  clearViewAsCompany: () => void;
}

const ViewAsContext = createContext<ViewAsContextType | undefined>(undefined);

export function ViewAsProvider({ children }: { children: ReactNode }) {
  const [viewAsCompanyId, setViewAsCompanyId] = useState<string | null>(() => {
    return localStorage.getItem('viewAsCompanyId');
  });
  const [viewAsCompanyName, setViewAsCompanyName] = useState<string | null>(() => {
    return localStorage.getItem('viewAsCompanyName');
  });

  const setViewAsCompany = (companyId: string | null, companyName: string | null) => {
    setViewAsCompanyId(companyId);
    setViewAsCompanyName(companyName);
    
    if (companyId && companyName) {
      localStorage.setItem('viewAsCompanyId', companyId);
      localStorage.setItem('viewAsCompanyName', companyName);
    } else {
      localStorage.removeItem('viewAsCompanyId');
      localStorage.removeItem('viewAsCompanyName');
    }
  };

  const clearViewAsCompany = () => {
    setViewAsCompanyId(null);
    setViewAsCompanyName(null);
    localStorage.removeItem('viewAsCompanyId');
    localStorage.removeItem('viewAsCompanyName');
  };

  return (
    <ViewAsContext.Provider value={{ viewAsCompanyId, viewAsCompanyName, setViewAsCompany, clearViewAsCompany }}>
      {children}
    </ViewAsContext.Provider>
  );
}

export function useViewAs() {
  const context = useContext(ViewAsContext);
  if (context === undefined) {
    throw new Error('useViewAs must be used within a ViewAsProvider');
  }
  return context;
}
