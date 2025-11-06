# SynthiaFuse DevTeam V2 - Development Instructions

## 🎯 PROJECT MISSION

Build a **hyper-optimized, token-efficient multi-agent development system** that achieves:
- **85-90% token reduction** (516k → 49k per operation)
- **85-90% cost reduction** ($6-10/day → $0.50-1/day)
- **40-73% performance improvement** (faster responses, higher throughput)
- **Maintained or improved quality** (same or better code quality)

## 🔴 CRITICAL REQUIREMENTS

### Professional Communication
- ALWAYS maintain professional, objective tone
- NEVER use profanity or unprofessional language
- Focus on facts, solutions, clear communication

### White Label Requirement
- NEVER include Claude, Claude Code, or Anthropic references in commits
- NEVER add "Generated with Claude Code" or similar
- ALL commits must be professional and white-labeled

### Token Optimization First
- EVERY feature must consider token efficiency
- EVERY API call must go through optimization layer
- ALWAYS use the most efficient model for the task
- TRACK all token usage with comprehensive metrics

## 📊 ARCHITECTURE PRINCIPLES

### 1. Cache-First Design
- 80%+ cache hit rate target
- Cache all static/rarely-changing content
- Use Claude's prompt caching (90% savings on cached)
- Warm cache proactively

### 2. Intelligent Model Selection
- Haiku ($0.25/M) for: routing, simple queries, formatting, status
- Sonnet ($3/M) for: code gen, debugging, review, implementation
- Opus ($15/M) for: architecture, security, complex reasoning
- NEVER use expensive model for cheap tasks

### 3. Lazy Loading
- Load only what's needed, when needed
- Use metadata for discovery (not full contexts)
- Incremental context building
- Progressive enhancement

### 4. Smart Orchestration
- Minimize redundant operations
- Parallel execution when possible
- Shared context across agents
- Result synthesis and validation

### 5. Continuous Optimization
- Track all metrics
- Learn from execution
- Adapt over time
- A/B test optimizations

## 🏗️ CURRENT IMPLEMENTATION STATUS

### Week 1: Foundation & Quick Wins (IN PROGRESS)
- [ ] Token Budget Manager (Ticket 1.1) - NEXT
- [ ] Intelligent Model Selector (Ticket 1.2)
- [ ] Optimized Agent Discovery (Ticket 1.3)
- [ ] Token Usage Tracking (Ticket 1.4)
- [ ] MongoDB Query Optimization (Ticket 1.5)

### Week 2: Caching Infrastructure (PENDING)
- [ ] Prompt Cache Manager (Ticket 2.1)
- [ ] Agent Context Caching (Ticket 2.2)
- [ ] Shared Context Caching (Ticket 2.3)
- [ ] Cache Warming Strategy (Ticket 2.4)

### Week 3: Intelligent Orchestration (PENDING)
- [ ] Intelligent Orchestrator (Ticket 3.1)
- [ ] Parallel Agent Execution (Ticket 3.2)
- [ ] Agent Communication Protocol (Ticket 3.3)

### Week 4: Learning & Optimization (PENDING)
- [ ] Adaptive Model Selection (Ticket 4.1)
- [ ] Performance Monitoring Dashboard (Ticket 4.2)
- [ ] A/B Testing Framework (Ticket 4.3)
- [ ] Continuous Optimization Engine (Ticket 4.4)

## 📁 PROJECT STRUCTURE

```
synthiafuse-devteam-v2/
├── research/optimization-v2/     # All research and planning
├── optimization/                 # Token optimization layer
│   ├── token-budget-manager.js
│   ├── model-selector.js
│   ├── cache-manager.js
│   ├── usage-tracker.js
│   └── __tests__/
├── orchestration/                # Intelligent orchestrator
│   ├── orchestrator.js
│   ├── task-analyzer.js
│   ├── result-synthesizer.js
│   └── __tests__/
├── agents/                       # Optimized agent system
│   ├── agent-discovery.js
│   ├── agent-metadata.json
│   └── shared-context-manager.js
├── devteam/                      # Enhanced core
│   ├── database/
│   │   └── optimized-state-manager.js
│   └── memory/                   # Agent contexts (will be optimized)
├── scripts/                      # Utilities
│   ├── extract-agent-metadata.js
│   ├── warm-cache.js
│   ├── backup-to-do-spaces.js
│   └── benchmark-optimization.js
└── tests/                        # Test suites
    ├── unit/
    ├── integration/
    └── performance/
```

## 🎯 DEVELOPMENT GUIDELINES

### When Writing Code

1. **Token Efficiency First**
   - Consider token cost of every operation
   - Use caching wherever possible
   - Choose the right model for the task
   - Track usage comprehensively

2. **Test-Driven Development**
   - Write tests before code
   - Aim for 80%+ coverage
   - Include performance tests
   - Benchmark token usage

3. **Documentation**
   - Clear, concise comments
   - JSDoc for all public functions
   - README for each module
   - Update main docs

4. **Error Handling**
   - Graceful degradation
   - Comprehensive logging
   - Budget enforcement
   - Rollback capabilities

### When Using Claude API

```javascript
// ALWAYS route through optimization layer
const optimizationLayer = require('./optimization');

// BAD - Direct call
const response = await claude.messages.create({...});

// GOOD - Through optimization layer
const response = await optimizationLayer.optimizedCall({
  task: taskDescription,
  context: contextData,
  budgetLevel: 'standard' // or 'aggressive'
});
```

### Model Selection Guidelines

```javascript
// Complexity scoring
const complexity = scoreTaskComplexity(task);

if (complexity <= 2) {
  // Simple: routing, status, formatting
  model = 'claude-3-haiku-20240307';
} else if (complexity <= 7) {
  // Medium: code gen, debugging, review
  model = 'claude-3-5-sonnet-20241022';
} else {
  // Complex: architecture, security, critical decisions
  model = 'claude-3-opus-20240229';
}
```

### Caching Strategy

```javascript
// Mark content as cacheable
const prompt = [{
  type: "text",
  text: staticContent,
  cache_control: { type: "ephemeral" } // Cache this!
}, {
  type: "text",
  text: dynamicContent // Don't cache
}];
```

## 🧪 TESTING REQUIREMENTS

### Unit Tests
- All optimization components
- Model selection logic
- Cache management
- Budget tracking
- 80%+ coverage

### Integration Tests
- End-to-end workflows
- API interactions
- Database operations
- Cache performance

### Performance Tests
- Token usage benchmarks
- Response time measurements
- Throughput testing
- Cache hit rates

### Quality Tests
- Code quality maintained
- Task success rates
- Agent accuracy
- User satisfaction

## 📊 METRICS TO TRACK

### Token Metrics
- Tokens per operation
- Tokens per project
- Tokens per agent
- Tokens per model
- Cache hit/miss rate

### Cost Metrics
- Cost per operation
- Cost per project
- Cost per day/week/month
- Budget utilization
- Savings vs V1

### Performance Metrics
- Response times
- Throughput (ops/hour)
- Cache performance
- Model selection accuracy
- Success rates

### Quality Metrics
- Task success rate
- Code quality scores
- Agent accuracy
- Error rates
- User satisfaction

## 🚨 CRITICAL PATHS

### Immediate Priorities (Week 1)
1. **Token Budget Manager** - Prevent runaway costs
2. **Model Selector** - Immediate 40-60% savings
3. **Agent Discovery** - Fix 95% waste problem
4. **Usage Tracking** - Visibility and control

### Success Criteria (Week 1)
- [ ] 40-50% token reduction achieved
- [ ] Budget limits enforced
- [ ] Model selection working
- [ ] Agent discovery optimized
- [ ] All tests passing

## 🔄 VERSION CONTROL

### Repository Strategy
- **V1**: `synthiafuse-devteam` (original, untouched)
- **V2**: `synthiafuse-devteam-v2` (this repo)
- **Backups**: Digital Ocean Spaces (automated)

### Commit Standards
```
feat: Add token budget manager with hard limits
fix: Correct cache invalidation timing
perf: Optimize agent metadata loading (90% reduction)
test: Add integration tests for model selector
docs: Update architecture documentation
```

### Branching
- `main` - Stable development
- `feature/*` - New features
- `fix/*` - Bug fixes
- `test/*` - Experimental changes

## 📝 REFERENCES

### Essential Docs
- `/research/optimization-v2/00-EXECUTIVE-SUMMARY.md` - Full plan
- `/research/optimization-v2/QUICK-REFERENCE.md` - Quick overview
- `/research/optimization-v2/implementation-plan/00-IMPLEMENTATION-ROADMAP.md` - Detailed tickets

### V1 Codebase
- Located at: `../synthiafuse-devteam/`
- Reference for agent contexts
- Copy essential utilities
- DON'T modify V1

### External Resources
- Claude API Docs: https://docs.anthropic.com
- Prompt Caching: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
- Model Comparison: https://docs.anthropic.com/en/docs/about-claude/models

## 🎯 CURRENT FOCUS

**RIGHT NOW**: Implementing Token Budget Manager (Ticket 1.1)

**File**: `/optimization/token-budget-manager.js`

**Requirements**:
- Track token usage across hourly/daily/weekly/project budgets
- Alert at 70%, 85%, 100% thresholds
- Enforce hard limits with graceful degradation
- Enable aggressive optimization mode when needed
- Comprehensive logging and metrics

**Next**: Model Selector, then Agent Discovery optimization

---

**Let's build the most efficient AI development system ever created! 🚀**
