import { useState } from 'react'

export default function WorkflowManager({ workflows, onStart, onStop, onUpdateSchedule }) {
  const [editingSchedule, setEditingSchedule] = useState(null)
  const [scheduleValue, setScheduleValue] = useState('')

  const handleSaveSchedule = (workflowId) => {
    onUpdateSchedule(workflowId, scheduleValue)
    setEditingSchedule(null)
    setScheduleValue('')
  }

  const getWorkflowBadge = (workflow) => {
    if (workflow.isActive) return <span className="badge badge-success">RUNNING</span>
    if (workflow.type === 'scheduled') return <span className="badge badge-info">SCHEDULED</span>
    return <span className="badge badge-warning">MANUAL</span>
  }

  const formatCron = (triggers) => {
    if (!triggers || triggers.length === 0) return 'Manual trigger only'
    const cron = triggers[0].replace('cron:', '')

    const patterns = {
      '0 2 * * *': 'Daily at 2:00 AM',
      '0 3 * * *': 'Daily at 3:00 AM',
      '0 0 * * *': 'Daily at midnight',
      '0 * * * *': 'Every hour'
    }

    return patterns[cron] || cron
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Workflow Management</h2>
        <span style={{ fontSize: '14px', color: '#94a3b8' }}>
          {workflows.length} workflows configured
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {workflows.map(workflow => (
          <div key={workflow.id} style={{
            padding: '20px',
            background: '#0f172a',
            borderRadius: '8px',
            border: workflow.isActive ? '2px solid #10b981' : '2px solid transparent'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600' }}>{workflow.name}</h3>
                  {getWorkflowBadge(workflow)}
                </div>
                <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '12px' }}>
                  {workflow.description}
                </p>

                {workflow.type === 'scheduled' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {editingSchedule === workflow.id ? (
                      <>
                        <input
                          type="text"
                          value={scheduleValue}
                          onChange={(e) => setScheduleValue(e.target.value)}
                          placeholder="cron:0 2 * * *"
                          style={{
                            padding: '8px 12px',
                            background: '#1a1f35',
                            border: '1px solid #334155',
                            borderRadius: '6px',
                            color: '#f8fafc',
                            flex: 1
                          }}
                        />
                        <button
                          onClick={() => handleSaveSchedule(workflow.id)}
                          className="btn btn-success"
                          style={{ padding: '6px 12px', fontSize: '13px' }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingSchedule(null)
                            setScheduleValue('')
                          }}
                          className="btn"
                          style={{ padding: '6px 12px', fontSize: '13px', background: '#334155', color: '#fff' }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <div style={{
                          padding: '6px 12px',
                          background: '#1a1f35',
                          borderRadius: '6px',
                          fontSize: '13px',
                          color: '#94a3b8'
                        }}>
                          {formatCron(workflow.triggers)}
                        </div>
                        <button
                          onClick={() => {
                            setEditingSchedule(workflow.id)
                            setScheduleValue(workflow.triggers?.[0] || '')
                          }}
                          className="btn"
                          style={{ padding: '6px 12px', fontSize: '13px', background: '#334155', color: '#fff' }}
                        >
                          Edit Schedule
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                {workflow.isActive ? (
                  <button
                    onClick={() => onStop(workflow.id)}
                    className="btn btn-danger"
                  >
                    Stop
                  </button>
                ) : (
                  <button
                    onClick={() => onStart(workflow.id)}
                    className="btn btn-success"
                  >
                    Start
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {workflows.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            No workflows configured
          </div>
        )}
      </div>
    </div>
  )
}
