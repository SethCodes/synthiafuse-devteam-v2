export default function AgentFeed({ agents }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#10b981'
      case 'idle': return '#f59e0b'
      default: return '#64748b'
    }
  }

  const getTimeAgo = (timestamp) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Active Agents</h2>
        <span style={{ fontSize: '14px', color: '#94a3b8' }}>
          {agents.filter(a => a.status === 'active').length} / {agents.length} active
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {agents.map(agent => (
          <div key={agent.id} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '16px',
            background: '#0f172a',
            borderRadius: '8px'
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: getStatusColor(agent.status),
              flexShrink: 0
            }} />

            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                {agent.name}
              </div>
              <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                {agent.currentTask || 'Idle'}
              </div>
            </div>

            <div style={{ fontSize: '12px', color: '#64748b' }}>
              {getTimeAgo(agent.lastActivity)}
            </div>
          </div>
        ))}

        {agents.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            No active agents
          </div>
        )}
      </div>
    </div>
  )
}
