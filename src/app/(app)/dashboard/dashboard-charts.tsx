"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

export function EmpresaBarChart({
  data,
}: {
  data: { nome: string; total: number }[];
}) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || data.length === 0) return null;

  const isDark = theme === "dark";
  const gridColor = isDark ? "rgba(148,163,184,0.15)" : "rgba(15,23,42,0.08)";
  const textColor = isDark ? "#cbd5e1" : "#475569";

  return (
    <Bar
      data={{
        labels: data.map((d) => d.nome),
        datasets: [
          {
            label: "Ativos",
            data: data.map((d) => d.total),
            backgroundColor: isDark ? "#818cf8" : "#4f46e5",
            borderRadius: 4,
            maxBarThickness: 28,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y" as const,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { color: textColor },
            grid: { color: gridColor },
          },
          y: {
            ticks: { color: textColor },
            grid: { display: false },
          },
        },
      }}
    />
  );
}

export function StatusDoughnutChart({
  ativos,
  inativos,
  revisar,
}: {
  ativos: number;
  inativos: number;
  revisar: number;
}) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const isDark = theme === "dark";
  const textColor = isDark ? "#cbd5e1" : "#475569";

  return (
    <Doughnut
      data={{
        labels: ["Ativos", "Inativos", "A revisar"],
        datasets: [
          {
            data: [ativos, inativos, revisar],
            backgroundColor: ["#10b981", "#94a3b8", "#f59e0b"],
            borderWidth: 0,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom" as const,
            labels: { color: textColor, boxWidth: 12, padding: 12 },
          },
        },
      }}
    />
  );
}
