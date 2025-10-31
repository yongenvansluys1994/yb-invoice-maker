import React from "react";

export default function SoftCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`soft-card ${className ?? ""}`}>{children}</div>;
}