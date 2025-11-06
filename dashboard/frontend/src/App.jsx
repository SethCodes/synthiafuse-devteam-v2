import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import SystemHealth from './components/SystemHealth'
import MetricsCharts from './components/MetricsCharts'
import ServiceControls from './components/ServiceControls'
import WorkflowManager from './components/WorkflowManager'
import AgentFeed from './components/AgentFeed'
import ActivityFeed from './components/ActivityFeed'

const API_URL = 'http://localhost:4500'

function App() {
  const [socket, setSocket] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [budget, setBudget] = useState(null)
  const [agents, setAgents] = useState([])
  const [workflows, setWorkflows] = useState([])
  const [activity, setActivity] = useState([])
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    // Connect to WebSocket
    const newSocket = io(API_URL)
    setSocket(newSocket)

    newSocket.on('connect', () => {
      console.log('Connected to dashboard API')
      setConnected(true)
    })

    newSocket.on('disconnect', () => {
      console.log('Disconnected from dashboard API')
      setConnected(false)
    })

    newSocket.on('metrics', (data) => setMetrics(data))
    newSocket.on('budget', (data) => setBudget(data))
    newSocket.on('agents', (data) => setAgents(data.active))
    newSocket.on('workflows', (data) => setWorkflows(data))

    // Fetch initial data
    fetchInitialData()

    return () => newSocket.close()
  }, [])

  const fetchInitialData = async () => {
    try {
      const [metricsRes, budgetRes, agentsRes, workflowsRes, activityRes] = await Promise.all([
        fetch(`${API_URL}/api/metrics`),
        fetch(`${API_URL}/api/budget`),
        fetch(`${API_URL}/api/agents`),
        fetch(`${API_URL}/api/workflows`),
        fetch(`${API_URL}/api/activity`)
      ])

      const [metricsData, budgetData, agentsData, workflowsData, activityData] = await Promise.all([
        metricsRes.json(),
        budgetRes.json(),
        agentsRes.json(),
        workflowsRes.json(),
        activityRes.json()
      ])

      setMetrics(metricsData.data)
      setBudget(budgetData.data)
      setAgents(agentsData.data.active)
      setWorkflows(workflowsData.data)
      setActivity(activityData.data)
    } catch (error) {
      console.error('Failed to fetch initial data:', error)
    }
  }

  const toggleService = async (service, enabled) => {
    try {
      await fetch(`${API_URL}/api/services/${service}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      })
    } catch (error) {
      console.error(`Failed to toggle ${service}:`, error)
    }
  }

  const startWorkflow = async (id) => {
    try {
      await fetch(`${API_URL}/api/workflows/${id}/start`, { method: 'POST' })
    } catch (error) {
      console.error(`Failed to start workflow ${id}:`, error)
    }
  }

  const stopWorkflow = async (id) => {
    try {
      await fetch(`${API_URL}/api/workflows/${id}/stop`, { method: 'POST' })
    } catch (error) {
      console.error(`Failed to stop workflow ${id}:`, error)
    }
  }

  const updateWorkflowSchedule = async (id, schedule) => {
    try {
      await fetch(`${API_URL}/api/workflows/${id}/schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule })
      })
    } catch (error) {
      console.error(`Failed to update workflow schedule:`, error)
    }
  }

  return (
    <div style={{ minHeight: '100vh', padding: '20px', background: '#0a0e1a' }}>
      <header style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px' }}>
              SynthiaFuse DevTeam V2
            </h1>
            <p style={{ color: '#94a3b8' }}>
              Real-time monitoring and workflow management
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: connected ? '#10b981' : '#ef4444'
            }} />
            <span style={{ color: '#94a3b8' }}>
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1" style={{ gap: '20px' }}>
        <SystemHealth metrics={metrics} budget={budget} />

        <div className="grid grid-cols-2">
          <MetricsCharts metrics={metrics} budget={budget} />
          <ServiceControls onToggle={toggleService} />
        </div>

        <WorkflowManager
          workflows={workflows}
          onStart={startWorkflow}
          onStop={stopWorkflow}
          onUpdateSchedule={updateWorkflowSchedule}
        />

        <div className="grid grid-cols-2">
          <AgentFeed agents={agents} />
          <ActivityFeed activity={activity} />
        </div>
      </div>
    </div>
  )
}

export default App
