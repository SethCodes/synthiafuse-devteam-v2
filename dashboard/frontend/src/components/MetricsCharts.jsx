import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function MetricsCharts({ metrics, budget }) {
  if (!metrics || !budget) {
    return (
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Metrics</h2>
        </div>
        <p style={{ color: '#94a3b8' }}>Loading...</p>
      </div>
    )
  }

  const tokenData = [
    { name: 'Hourly', value: budget.hourly.used, limit: budget.hourly.limit },
    { name: 'Daily', value: budget.daily.used, limit: budget.daily.limit }
  ]

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Token Usage</h2>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={tokenData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="name" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px' }}
            labelStyle={{ color: '#f8fafc' }}
          />
          <Bar dataKey="value" fill="#3b82f6" name="Used" />
          <Bar dataKey="limit" fill="#334155" name="Limit" />
        </BarChart>
      </ResponsiveContainer>

      <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ padding: '12px', background: '#0f172a', borderRadius: '8px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Avg Response Time</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{metrics.performance.avgResponseTime}s</div>
        </div>
        <div style={{ padding: '12px', background: '#0f172a', borderRadius: '8px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Weekly Usage</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{(metrics.tokenUsage.weekly / 1000).toFixed(0)}K</div>
        </div>
      </div>
    </div>
  )
}
