"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui";
import { formatCurrency } from "@/lib/format";

const COLORS = ["#22d3ee", "#38bdf8", "#818cf8", "#34d399", "#fbbf24", "#fb7185", "#a78bfa"];

function tooltipCurrency({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="text-muted">
          {entry.name === "amount" || entry.dataKey === "amount" ? formatCurrency(entry.value) : `${entry.value} item(ns)`}
        </p>
      ))}
    </div>
  );
}

export default function SaleDashboardCharts({ byType, daily }) {
  const pieData = (byType || []).map((row) => ({ name: row.name, value: row.amount }));

  return (
    <div className="mt-6 grid gap-4 xl:grid-cols-2">
      <Card>
        <h2 className="mb-3 font-semibold">Faturamento no período</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tickFormatter={(value) => (value >= 1000 ? `${Math.round(value / 1000)}k` : String(value))} />
              <Tooltip content={tooltipCurrency} />
              <Bar dataKey="amount" name="amount" fill="#22d3ee" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">Participação por tipo</h2>
        <div className="h-64">
          {pieData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                  {pieData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip formatter={(value) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-muted">Sem baixas no período.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
