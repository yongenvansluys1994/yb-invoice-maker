"use client";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
} from "chart.js";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

export default function ChartBarMini({ labels, data, title }: { labels: string[]; data: number[]; title?: string }) {
  return (
    <div className="soft-card p-4">
      {title ? <div className="text-sm font-medium text-black/70 mb-2">{title}</div> : null}
      <Bar
        data={{
          labels,
          datasets: [
            {
              label: title || "Jumlah",
              data,
              backgroundColor: "#60a5fa", // sky-400
              borderRadius: 6,
              maxBarThickness: 26,
            },
          ],
        }}
        options={{
          responsive: true,
          plugins: { legend: { display: false }, tooltip: { enabled: true } },
          scales: { x: { display: false }, y: { display: false } },
        }}
      />
    </div>
  );
}