"use client";
import { useState } from "react";

type Props = {
  onClick: () => Promise<any>;
  children: React.ReactNode;
  className?: string;
  busyText?: string;
  disabled?: boolean;
};

export function AsyncButton({
  onClick,
  children,
  className = "rounded-lg border px-3 py-2 text-sm",
  busyText = "Procesando…",
  disabled = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      className={`${className} ${loading || disabled ? "opacity-60 cursor-not-allowed" : ""}`}
      disabled={loading || disabled}
      onClick={async () => {
        try {
          setLoading(true);
          await onClick();
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? busyText : children}
    </button>
  );
}
