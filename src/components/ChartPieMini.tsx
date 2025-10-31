"use client";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function ChartPieMini({
  labels,
  data,
  title,
  colors = ["#a78bfa", "#93c5fd", "#fb7185", "#34d399"],
}: {
  labels: string[];
  data: number[];
  title?: string;
  colors?: string[];
}) {
  return (
    <div className="soft-card p-4">
      {title ? <div className="mb-2 text-sm font-medium text-black/70">{title}</div> : null}
      <Doughnut
        data={{
          labels,
          datasets: [
            {
              data,
              backgroundColor: colors.slice(0, data.length),
              borderWidth: 0,
            },
          ],
        }}
        options={{
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: { enabled: true },
          },
          cutout: "60%",
        }}
      />
    </div>
  );
}