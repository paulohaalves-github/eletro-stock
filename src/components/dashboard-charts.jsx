"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid } from "recharts";
import { Card } from "@/components/ui";
import { CONDITION_LABELS } from "@/lib/constants";

const COLORS = ["#22d3ee", "#38bdf8", "#818cf8", "#34d399", "#fbbf24", "#fb7185", "#a78bfa"];

export default function DashboardCharts({ categoryChart, conditionChart, movementChart }) {
  const conditions = conditionChart.map((item) => ({ ...item, name: CONDITION_LABELS[item.name] || item.name }));

  return (
    <div className="mt-6 grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-1">
        <h2 className="mb-3 font-semibold">Estoque por categoria</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryChart}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#22d3ee" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">Estoque por condição</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={conditions} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                {conditions.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">Movimentações</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={movementChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="entradas" stroke="#22d3ee" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="saidas" stroke="#fb7185" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
