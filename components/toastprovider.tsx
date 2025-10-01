"use client";

import { createContext, useContext, useState } from "react";
import { Toast } from "@/components/toast"; // 👈 asegúrate que el archivo se llama Toast.tsx con T mayúscula

type ToastType = "ok" | "err";
type ToastItem = { id: number; msg: string; type: ToastType };

type ToastCtx = {
  push: (msg: string, type?: ToastType) => void;
  notify: (msg: string, type?: ToastType) => void; // alias opcional
};

const Ctx = createContext<ToastCtx>({
  push: () => {},
  notify: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = (msg: string, type: ToastType = "ok") => {
    setToasts((t) => [...t, { id: Date.now() + Math.random(), msg, type }]);
  };

  const remove = (id: number) => {
    setToasts((all) => all.filter((x) => x.id !== id));
  };

  return (
    <Ctx.Provider value={{ push, notify: push }}>
      {children}
      {toasts.map((t) => (
        <Toast
          key={t.id}
          message={t.msg}
          type={t.type}
          onDone={() => remove(t.id)}
        />
      ))}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
