"use client";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
} from "chart.js";

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip);

export default function ChartMini({ dataPoints, labels: customLabels, title }: { dataPoints: number[]; labels?: string[]; title?: string }) {
  const labels = customLabels ?? Array.from({ length: dataPoints.length }).map((_, i) => `W${i + 1}`);
  return (
    <div className="soft-card p-4">
      {title ? <div className="text-sm font-medium text-black/70 mb-2">{title}</div> : null}
      <Line
        data={{
          labels,
          datasets: [
            {
              label: title || "Pendapatan",
              data: dataPoints,
              borderColor: "#fb7185", // rose-400
              backgroundColor: "rgba(251, 113, 133, 0.2)",
              tension: 0.35,
            },
          ],
        }}
        options={{
          responsive: true,
          plugins: { legend: { display: false } },
          scales: { x: { display: false }, y: { display: false } },
        }}
      />
    </div>
  );
}