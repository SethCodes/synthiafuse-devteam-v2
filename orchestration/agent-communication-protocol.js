/**
 * Agent Communication Protocol
 *
 * Standardized messaging system for inter-agent communication, shared state
 * management, and event-based coordination.
 *
 * Features:
 * - Inter-agent messaging
 * - Shared state management
 * - Event-based coordination
 * - Message routing and delivery
 * - State synchronization
 * - Protocol standardization
 *
 * Message Types:
 * - REQUEST: Agent requesting information/action
 * - RESPONSE: Response to request
 * - NOTIFICATION: One-way notification
 * - STATE_UPDATE: Shared state update
 * - COORDINATION: Coordination message
 *
 * @module AgentCommunicationProtocol
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

class AgentCommunicationProtocol extends EventEmitter {
  constructor(options = {}) {
    super();

    // Configuration
    this.config = {
      messageTimeout: options.messageTimeout || 30000, // 30 seconds
      maxMessageSize: options.maxMessageSize || 100000, // 100KB
      enableHistory: options.enableHistory !== false,
      historySize: options.historySize || 1000
    };

    // Message routing
    this.agents = new Map(); // agentId -> agent metadata
    this.messageQueue = new Map(); // messageId -> message
    this.pendingRequests = new Map(); // requestId -> { resolve, reject, timeout }

    // Shared state
    this.sharedState = new Map(); // stateKey -> value
    this.stateSubscriptions = new Map(); // stateKey -> Set of agentIds

    // Message history
    this.messageHistory = [];

    // Statistics
    this.stats = {
      messagesSent: 0,
      messagesDelivered: 0,
      messagesFailed: 0,
      requestsSent: 0,
      requestsAnswered: 0,
      stateUpdates: 0,
      avgResponseTime: 0
    };
  }

  /**
   * Register an agent with the communication system
   * @param {string} agentId - Agent ID
   * @param {Object} metadata - Agent metadata
   */
  registerAgent(agentId, metadata = {}) {
    this.agents.set(agentId, {
      id: agentId,
      name: metadata.name || agentId,
      type: metadata.type || 'generic',
      capabilities: metadata.capabilities || [],
      registeredAt: Date.now(),
      lastActive: Date.now()
    });

    this.emit('agent-registered', { agentId, metadata });

    console.log(`📡 Agent registered: ${metadata.name || agentId}`);
  }

  /**
   * Unregister an agent
   * @param {string} agentId - Agent ID
   */
  unregisterAgent(agentId) {
    if (this.agents.has(agentId)) {
      this.agents.delete(agentId);

      // Clean up subscriptions
      for (const [stateKey, subscribers] of this.stateSubscriptions.entries()) {
        subscribers.delete(agentId);
        if (subscribers.size === 0) {
          this.stateSubscriptions.delete(stateKey);
        }
      }

      this.emit('agent-unregistered', { agentId });

      console.log(`📡 Agent unregistered: ${agentId}`);
    }
  }

  /**
   * Send a message from one agent to another
   * @param {Object} message - Message to send
   * @returns {Promise<Object>} - Response (if REQUEST type)
   */
  async sendMessage(message) {
    const messageId = message.id || uuidv4();
    const timestamp = Date.now();

    // Validate message
    this.validateMessage(message);

    const fullMessage = {
      id: messageId,
      from: message.from,
      to: message.to,
      type: message.type,
      payload: message.payload,
      timestamp,
      metadata: message.metadata || {}
    };

    // Add to history
    if (this.config.enableHistory) {
      this.addToHistory(fullMessage);
    }

    // Update stats
    this.stats.messagesSent++;

    // Route message based on type
    switch (message.type) {
      case 'REQUEST':
        return await this.handleRequest(fullMessage);

      case 'RESPONSE':
        this.handleResponse(fullMessage);
        break;

      case 'NOTIFICATION':
        this.handleNotification(fullMessage);
        break;

      case 'STATE_UPDATE':
        this.handleStateUpdate(fullMessage);
        break;

      case 'COORDINATION':
        this.handleCoordination(fullMessage);
        break;

      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }

    this.emit('message-sent', fullMessage);

    return { messageId, status: 'sent' };
  }

  /**
   * Handle REQUEST message
   * @param {Object} message - Request message
   * @returns {Promise<Object>} - Response
   */
  async handleRequest(message) {
    const requestId = message.id;

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout: ${requestId}`));
        this.stats.messagesFailed++;
      }, this.config.messageTimeout);

      // Store pending request
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout,
        startTime: Date.now()
      });

      // Emit request for agent to handle
      this.emit('request-received', message);

      this.stats.requestsSent++;
    });
  }

  /**
   * Handle RESPONSE message
   * @param {Object} message - Response message
   */
  handleResponse(message) {
    const requestId = message.metadata.requestId;

    if (this.pendingRequests.has(requestId)) {
      const { resolve, timeout, startTime } = this.pendingRequests.get(requestId);

      clearTimeout(timeout);
      this.pendingRequests.delete(requestId);

      // Update response time stats
      const responseTime = Date.now() - startTime;
      this.updateAverageResponseTime(responseTime);

      resolve(message.payload);

      this.stats.messagesDelivered++;
      this.stats.requestsAnswered++;
    }
  }

  /**
   * Handle NOTIFICATION message
   * @param {Object} message - Notification message
   */
  handleNotification(message) {
    this.emit('notification-received', message);
    this.stats.messagesDelivered++;
  }

  /**
   * Handle STATE_UPDATE message
   * @param {Object} message - State update message
   */
  handleStateUpdate(message) {
    const { key, value } = message.payload;

    // Update shared state
    this.sharedState.set(key, value);

    // Notify subscribers
    if (this.stateSubscriptions.has(key)) {
      const subscribers = this.stateSubscriptions.get(key);

      for (const agentId of subscribers) {
        this.emit('state-updated', {
          agentId,
          key,
          value,
          updatedBy: message.from
        });
      }
    }

    this.stats.stateUpdates++;
    this.stats.messagesDelivered++;
  }

  /**
   * Handle COORDINATION message
   * @param {Object} message - Coordination message
   */
  handleCoordination(message) {
    this.emit('coordination-message', message);
    this.stats.messagesDelivered++;
  }

  /**
   * Subscribe to shared state changes
   * @param {string} agentId - Agent ID
   * @param {string} stateKey - State key to subscribe to
   */
  subscribeToState(agentId, stateKey) {
    if (!this.stateSubscriptions.has(stateKey)) {
      this.stateSubscriptions.set(stateKey, new Set());
    }

    this.stateSubscriptions.get(stateKey).add(agentId);

    this.emit('state-subscribed', { agentId, stateKey });
  }

  /**
   * Unsubscribe from shared state changes
   * @param {string} agentId - Agent ID
   * @param {string} stateKey - State key to unsubscribe from
   */
  unsubscribeFromState(agentId, stateKey) {
    if (this.stateSubscriptions.has(stateKey)) {
      this.stateSubscriptions.get(stateKey).delete(agentId);

      if (this.stateSubscriptions.get(stateKey).size === 0) {
        this.stateSubscriptions.delete(stateKey);
      }

      this.emit('state-unsubscribed', { agentId, stateKey });
    }
  }

  /**
   * Get shared state value
   * @param {string} key - State key
   * @returns {*} - State value
   */
  getSharedState(key) {
    return this.sharedState.get(key);
  }

  /**
   * Set shared state value
   * @param {string} key - State key
   * @param {*} value - State value
   * @param {string} updatedBy - Agent ID that updated
   */
  setSharedState(key, value, updatedBy) {
    const message = {
      from: updatedBy,
      to: 'broadcast',
      type: 'STATE_UPDATE',
      payload: { key, value }
    };

    return this.sendMessage(message);
  }

  /**
   * Broadcast message to all agents
   * @param {Object} message - Message to broadcast
   */
  async broadcast(message) {
    const agentIds = Array.from(this.agents.keys());

    const broadcasts = agentIds.map(agentId =>
      this.sendMessage({
        ...message,
        to: agentId
      })
    );

    const results = await Promise.allSettled(broadcasts);

    return {
      sent: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length
    };
  }

  /**
   * Validate message format
   * @param {Object} message - Message to validate
   */
  validateMessage(message) {
    if (!message.from) {
      throw new Error('Message must have "from" field');
    }

    if (!message.to) {
      throw new Error('Message must have "to" field');
    }

    if (!message.type) {
      throw new Error('Message must have "type" field');
    }

    const validTypes = ['REQUEST', 'RESPONSE', 'NOTIFICATION', 'STATE_UPDATE', 'COORDINATION'];
    if (!validTypes.includes(message.type)) {
      throw new Error(`Invalid message type: ${message.type}`);
    }

    // Check message size
    const messageSize = JSON.stringify(message).length;
    if (messageSize > this.config.maxMessageSize) {
      throw new Error(`Message too large: ${messageSize} bytes (max: ${this.config.maxMessageSize})`);
    }
  }

  /**
   * Add message to history
   * @param {Object} message - Message to add
   */
  addToHistory(message) {
    this.messageHistory.push(message);

    // Trim history if too large
    if (this.messageHistory.length > this.config.historySize) {
      this.messageHistory = this.messageHistory.slice(-this.config.historySize);
    }
  }

  /**
   * Update average response time
   * @param {number} responseTime - Response time in ms
   */
  updateAverageResponseTime(responseTime) {
    const count = this.stats.requestsAnswered;

    if (count === 0) {
      this.stats.avgResponseTime = responseTime;
    } else {
      this.stats.avgResponseTime =
        (this.stats.avgResponseTime * (count - 1) + responseTime) / count;
    }
  }

  /**
   * Get agent information
   * @param {string} agentId - Agent ID
   * @returns {Object|null} - Agent metadata
   */
  getAgent(agentId) {
    return this.agents.get(agentId) || null;
  }

  /**
   * Get all registered agents
   * @returns {Array<Object>} - All agents
   */
  getAllAgents() {
    return Array.from(this.agents.values());
  }

  /**
   * Get message history
   * @param {Object} filters - Optional filters
   * @returns {Array<Object>} - Filtered history
   */
  getMessageHistory(filters = {}) {
    let history = [...this.messageHistory];

    if (filters.from) {
      history = history.filter(m => m.from === filters.from);
    }

    if (filters.to) {
      history = history.filter(m => m.to === filters.to);
    }

    if (filters.type) {
      history = history.filter(m => m.type === filters.type);
    }

    if (filters.since) {
      history = history.filter(m => m.timestamp >= filters.since);
    }

    return history;
  }

  /**
   * Get statistics
   * @returns {Object} - Statistics
   */
  getStatistics() {
    return {
      agents: {
        registered: this.agents.size,
        byType: this.getAgentsByType()
      },
      messages: {
        sent: this.stats.messagesSent,
        delivered: this.stats.messagesDelivered,
        failed: this.stats.messagesFailed,
        deliveryRate: (this.stats.messagesDelivered / this.stats.messagesSent) * 100 || 0
      },
      requests: {
        sent: this.stats.requestsSent,
        answered: this.stats.requestsAnswered,
        pending: this.pendingRequests.size,
        avgResponseTime: Math.round(this.stats.avgResponseTime)
      },
      state: {
        keys: this.sharedState.size,
        subscriptions: this.stateSubscriptions.size,
        updates: this.stats.stateUpdates
      },
      history: {
        size: this.messageHistory.length,
        maxSize: this.config.historySize
      }
    };
  }

  /**
   * Get agents grouped by type
   * @returns {Object} - Agents by type
   */
  getAgentsByType() {
    const byType = {};

    for (const agent of this.agents.values()) {
      const type = agent.type || 'unknown';
      byType[type] = (byType[type] || 0) + 1;
    }

    return byType;
  }

  /**
   * Clear message history
   */
  clearHistory() {
    this.messageHistory = [];
  }

  /**
   * Reset all state
   */
  reset() {
    this.agents.clear();
    this.messageQueue.clear();
    this.pendingRequests.clear();
    this.sharedState.clear();
    this.stateSubscriptions.clear();
    this.messageHistory = [];

    this.stats = {
      messagesSent: 0,
      messagesDelivered: 0,
      messagesFailed: 0,
      requestsSent: 0,
      requestsAnswered: 0,
      stateUpdates: 0,
      avgResponseTime: 0
    };
  }

  /**
   * Cleanup and destroy
   */
  destroy() {
    // Clear all pending request timeouts
    for (const { timeout } of this.pendingRequests.values()) {
      clearTimeout(timeout);
    }

    this.reset();
    this.removeAllListeners();
  }
}

module.exports = AgentCommunicationProtocol;
