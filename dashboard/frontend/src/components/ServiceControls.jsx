import { useState } from 'react'

export default function ServiceControls({ onToggle }) {
  const [services, setServices] = useState({
    optimization: false,
    monitoring: true,
    'background-worker': false
  })

  const handleToggle = (service) => {
    const newState = !services[service]
    setServices({ ...services, [service]: newState })
    onToggle(service, newState)
  }

  const serviceList = [
    { id: 'optimization', name: 'Continuous Optimization', description: 'Auto-tune system parameters' },
    { id: 'monitoring', name: 'Performance Monitoring', description: 'Track metrics and alerts' },
    { id: 'background-worker', name: 'Background Worker', description: 'Process queued tasks' }
  ]

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Service Controls</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {serviceList.map(service => (
          <div key={service.id} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px',
            background: '#0f172a',
            borderRadius: '8px'
          }}>
            <div>
              <div style={{ fontWeight: '500', marginBottom: '4px' }}>{service.name}</div>
              <div style={{ fontSize: '13px', color: '#94a3b8' }}>{service.description}</div>
            </div>

            <button
              onClick={() => handleToggle(service.id)}
              className={`btn ${services[service.id] ? 'btn-success' : 'btn-danger'}`}
              style={{ minWidth: '80px' }}
            >
              {services[service.id] ? 'ON' : 'OFF'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
