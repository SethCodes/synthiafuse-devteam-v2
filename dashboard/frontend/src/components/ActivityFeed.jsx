export default function ActivityFeed({ activity }) {
  const getActivityIcon = (type) => {
    switch (type) {
      case 'task-completed': return '✓'
      case 'optimization': return '⚡'
      case 'cache-warming': return '🔥'
      default: return '•'
    }
  }

  const getActivityColor = (type) => {
    switch (type) {
      case 'task-completed': return '#10b981'
      case 'optimization': return '#3b82f6'
      case 'cache-warming': return '#f59e0b'
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
        <h2 className="card-title">Activity Feed</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {activity.map((item, idx) => (
          <div key={idx} style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '12px',
            background: '#0f172a',
            borderRadius: '8px'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: getActivityColor(item.type),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              flexShrink: 0
            }}>
              {getActivityIcon(item.type)}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', marginBottom: '4px' }}>
                {item.message}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                {item.agent} • {getTimeAgo(item.timestamp)}
              </div>
            </div>
          </div>
        ))}

        {activity.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            No recent activity
          </div>
        )}
      </div>
    </div>
  )
}
