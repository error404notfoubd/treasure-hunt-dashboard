"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const toast = useCallback((message, type = "success") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`
              bg-surface-2 border border-surface-4 rounded-lg px-4 py-3
              text-sm shadow-xl animate-slide-in-right flex items-center gap-2
              ${t.type === "success" ? "border-l-[3px] border-l-success" : ""}
              ${t.type === "error" ? "border-l-[3px] border-l-danger" : ""}
            `}
          >
            <span>
              {t.type === "success" ? (
                <span className="text-success">✓</span>
              ) : (
                <span className="text-danger">✕</span>
              )}
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast must be used within ToastProvider");
  return toast;
}
