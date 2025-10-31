import React from "react";

type StatCardProps = {
  title: string;
  value: React.ReactNode | number | string;
  icon?: React.ReactNode;
  variant?: "purple" | "pink" | "blue" | "green";
};

const variantMap: Record<NonNullable<StatCardProps["variant"]>, string> = {
  purple: "from-violet-500 to-fuchsia-500",
  pink: "from-pink-500 to-rose-500",
  blue: "from-sky-500 to-indigo-500",
  green: "from-emerald-500 to-teal-500",
};

export default function StatCard({ title, value, icon, variant = "purple" }: StatCardProps) {
  const gradient = variantMap[variant];
  return (
    <div className={`rounded-2xl p-5 text-white shadow-lg bg-gradient-to-br ${gradient} relative overflow-hidden`}>
      <div className="text-sm font-medium opacity-90">{title}</div>
      <div className="mt-2 flex items-center justify-between">
        <div className="text-3xl font-bold">{value}</div>
        {icon ? (
          <div className="bg-white/25 p-3 rounded-xl">
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}