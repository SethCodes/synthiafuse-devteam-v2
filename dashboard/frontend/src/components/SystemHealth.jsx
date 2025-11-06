export default function SystemHealth({ metrics, budget }) {
  if (!metrics || !budget) {
    return (
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">System Health</h2>
        </div>
        <p style={{ color: '#94a3b8' }}>Loading...</p>
      </div>
    )
  }

  const getHealthStatus = () => {
    const budgetUsage = parseFloat(budget.hourly.percentage)
    if (budgetUsage > 85) return { status: 'warning', color: '#f59e0b' }
    if (budgetUsage > 70) return { status: 'caution', color: '#eab308' }
    return { status: 'healthy', color: '#10b981' }
  }

  const health = getHealthStatus()

  const stats = [
    {
      label: 'Hourly Budget',
      value: `${budget.hourly.percentage}%`,
      subtitle: `${budget.hourly.used.toLocaleString()} / ${budget.hourly.limit.toLocaleString()} tokens`,
      color: parseFloat(budget.hourly.percentage) > 70 ? '#f59e0b' : '#10b981'
    },
    {
      label: 'Cache Hit Rate',
      value: `${metrics.performance.cacheHitRate}%`,
      subtitle: 'Avg over last hour',
      color: '#3b82f6'
    },
    {
      label: 'Token Savings',
      value: `${metrics.optimization.savingsPercentage}%`,
      subtitle: `${metrics.optimization.tokensSaved.toLocaleString()} tokens saved`,
      color: '#10b981'
    },
    {
      label: 'Throughput',
      value: `${metrics.performance.throughput}`,
      subtitle: 'Operations per hour',
      color: '#8b5cf6'
    }
  ]

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">System Health</h2>
        <span className={`badge badge-${health.status === 'healthy' ? 'success' : 'warning'}`}>
          {health.status.toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-4" style={{ gap: '16px' }}>
        {stats.map((stat, idx) => (
          <div key={idx} style={{
            padding: '16px',
            background: '#0f172a',
            borderRadius: '8px',
            borderLeft: `4px solid ${stat.color}`
          }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>
              {stat.label}
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>
              {stat.value}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              {stat.subtitle}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
