"use client";

import { useEffect } from "react";
import { IconX } from "./icons";

export default function Modal({ title, onClose, footer, children }) {
  useEffect(() => {
    const handleEsc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-surface-2 border border-surface-4 rounded-xl w-full max-w-[480px] mx-4 shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-3">
          <h3 className="text-[15px] font-bold">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-ink-3 hover:text-ink-1 hover:bg-surface-3 transition-colors"
          >
            <IconX />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <div className="flex gap-2 justify-end px-6 py-4 border-t border-surface-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
