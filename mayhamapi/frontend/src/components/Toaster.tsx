import React, { createContext, useContext, useState, useCallback } from 'react';

type Toast = { id: number; message: string };

const ToasterContext = createContext<{
  push: (message: string) => void;
} | null>(null);

export const useToaster = () => {
  const ctx = useContext(ToasterContext);
  if (!ctx) throw new Error('useToaster must be used within ToasterProvider');
  return ctx;
};

export const ToasterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((t) => [...t, { id, message }]);
    // Auto remove after 4s
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  // register global push so other non-hook code can call showToast()
  React.useEffect(() => {
    registerGlobalToaster(push);
    return () => registerGlobalToaster(() => {});
  }, [push]);

  return (
    <ToasterContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="bg-gray-900 text-white px-4 py-2 rounded shadow-lg max-w-sm ring-1 ring-black/10"
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToasterContext.Provider>
  );
};

// small convenience for non-hook usage; will be set by ToasterProvider
let globalPush: ((message: string) => void) | null = null;

export const registerGlobalToaster = (fn: (message: string) => void) => {
  globalPush = fn;
};

export const showToast = (message: string) => {
  if (globalPush) globalPush(message);
};

export default ToasterProvider;
