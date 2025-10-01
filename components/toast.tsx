"use client";
import { useEffect, useState } from "react";

type ToastProps = {
  message: string;
  type?: "ok" | "err";
  timeout?: number;
  onDone?: () => void;
};

export function Toast({ message, type = "ok", timeout = 2500, onDone }: ToastProps) {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => { setShow(false); onDone?.(); }, timeout);
    return () => clearTimeout(t);
  }, [timeout, onDone]);

  if (!show) return null;
  return (
    <div className={`fixed bottom-4 right-4 z-50 rounded-lg border px-3 py-2 text-sm shadow
      ${type === "ok" ? "bg-white border-green-600" : "bg-white border-red-600"}`}>
      {message}
    </div>
  );
}
