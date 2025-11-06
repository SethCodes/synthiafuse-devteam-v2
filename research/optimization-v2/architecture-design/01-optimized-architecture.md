# SynthiaFuse DevTeam V2 - Optimized Architecture
## Token-Efficient Multi-Agent Development System
## Design Date: 2025-11-05

---

## ARCHITECTURE VISION

Transform SynthiaFuse DevTeam from a token-heavy system ($6-10/day) into a **hyper-efficient, intelligent orchestration platform** ($0.50-1/day) while **maintaining or improving** development quality and capability.

**Core Principles**:
1. **Cache-First Design**: 80%+ cache hit rate target
2. **Intelligent Model Selection**: Right model for every task
3. **Lazy Loading**: Load only what's needed, when needed
4. **Smart Orchestration**: Minimize redundant operations
5. **Continuous Optimization**: Learn and adapt over time

---

## SYSTEM ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLAUDE CODE CLI INTERFACE                    │
│                    (Primary Entry Point)                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────────┐
│                    OPTIMIZATION LAYER                            │
│  ┌────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Token Budget   │  │  Model Selector │  │  Cache Manager  │ │
│  │ Manager        │  │  (Haiku/Sonnet/ │  │  (Prompt Cache) │ │
│  │                │  │   Opus Router)  │  │                 │ │
│  └────────────────┘  └─────────────────┘  └─────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────────┐
│              INTELLIGENT ORCHESTRATOR (Opus 4)                   │
│  • Task decomposition • Agent routing • Result synthesis        │
│  • Quality assurance • Error handling • Learning                │
└────────────────────────────┬────────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
┌─────────▼────────┐ ┌──────▼─────────┐ ┌─────▼────────────┐
│  AGENT DISCOVERY │ │ SHARED CONTEXT  │ │ STATE MANAGEMENT │
│  (Fast Metadata) │ │    MANAGER      │ │   (MongoDB)      │
│  Uses: Haiku     │ │ (Cached)        │ │  (Optimized)     │
└─────────┬────────┘ └──────┬─────────┘ └─────┬────────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
        ┌────────────────────┴─────────────────────┐
        │        SPECIALIST AGENT POOL             │
        │    (119 agents - Cached contexts)       │
        │  ┌────────┐ ┌────────┐ ┌────────┐      │
        │  │Backend │ │Frontend│ │Security│ ...  │
        │  │(Sonnet)│ │(Sonnet)│ │(Opus)  │      │
        │  └────────┘ └────────┘ └────────┘      │
        └──────────────────────────────────────────┘
```

---

## LAYER 1: OPTIMIZATION LAYER

### Component 1.1: Token Budget Manager

**Purpose**: Track, limit, and optimize token usage across all operations

**Implementation**:
```javascript
class TokenBudgetManager {
  constructor() {
    this.budgets = {
      hourly: 50000,    // 50k tokens/hour
      daily: 500000,    // 500k tokens/day
      weekly: 3000000,  // 3M tokens/week
      project: 1000000  // 1M tokens/project
    };

    this.usage = {
      current: {
        hour: 0,
        day: 0,
        week: 0
      },
      projects: new Map()
    };

    this.thresholds = {
      warning: 0.7,    // 70% usage warning
      aggressive: 0.85, // 85% enable aggressive optimization
      limit: 1.0       // 100% hard limit
    };
  }

  async requestTokens(amount, context) {
    // Check budget availability
    const availability = this.checkAvailability(amount);

    if (!availability.allowed) {
      // Try optimization strategies
      const optimized = await this.optimizeRequest(context);
      return await this.requestTokens(optimized.tokens, context);
    }

    // Track usage
    await this.recordUsage(amount, context);

    // Adjust optimization level based on usage
    this.adjustOptimizationLevel();

    return {
      allowed: true,
      tokens: amount,
      optimization: this.currentOptimizationLevel
    };
  }

  adjustOptimizationLevel() {
    const usage = this.usage.current.hour / this.budgets.hourly;

    if (usage > this.thresholds.aggressive) {
      this.optimizationLevel = 'aggressive';
      this.enableAggressiveCaching();
      this.preferCheaperModels();
      this.reduceContextWindow();
    } else if (usage > this.thresholds.warning) {
      this.optimizationLevel = 'moderate';
      this.enableStandardOptimizations();
    } else {
      this.optimizationLevel = 'standard';
    }
  }

  async optimizeRequest(context) {
    const strategies = [
      this.compressContext,
      this.useCachedContent,
      this.useSmartFiltering,
      this.switchToSmallerModel
    ];

    let optimized = context;
    for (const strategy of strategies) {
      optimized = await strategy(optimized);
      if (optimized.tokens < this.budgets.hourly * 0.05) {
        break; // Good enough
      }
    }

    return optimized;
  }
}
```

### Component 1.2: Model Selector

**Purpose**: Intelligently route tasks to optimal model based on complexity

**Implementation**:
```javascript
class IntelligentModelSelector {
  constructor() {
    this.models = {
      haiku: {
        name: 'claude-3-haiku-20240307',
        cost: 0.25,  // per M tokens
        speed: 'fastest',
        capabilities: ['routing', 'formatting', 'simple_queries', 'status']
      },
      sonnet: {
        name: 'claude-3-5-sonnet-20241022',
        cost: 3.0,
        speed: 'fast',
        capabilities: ['code_gen', 'debug', 'review', 'implementation', 'testing']
      },
      opus: {
        name: 'claude-3-opus-20240229',
        cost: 15.0,
        speed: 'moderate',
        capabilities: ['architecture', 'security', 'complex_reasoning', 'critical_decisions']
      }
    };

    this.complexityWeights = {
      // Task characteristics
      requiresArchitecture: 5,
      criticalDecision: 4,
      securityCritical: 4,
      multiSystemIntegration: 3,
      complexAlgorithm: 3,
      largeRefactoring: 3,
      novelProblem: 3,

      // Simplifying factors
      hasTemplate: -2,
      wellDocumented: -2,
      routineTask: -3,
      simpleQuery: -4
    };

    this.usageTracking = {
      selections: [],
      accuracy: new Map(), // Track if selection was appropriate
      corrections: []      // Track when we needed to upgrade
    };
  }

  selectModel(task, context = {}) {
    // Score task complexity
    const complexity = this.scoreComplexity(task);

    // Consider budget constraints
    const budgetLevel = context.budgetLevel || 'standard';

    // Consider cache availability
    const cacheAvailable = context.cacheHitProbability || 0;

    // Make selection
    let model = this.makeSelection(complexity, budgetLevel, cacheAvailable);

    // Track for learning
    this.trackSelection(task, model, complexity);

    return {
      model: model.name,
      rationale: this.explainSelection(complexity, model),
      estimatedCost: this.estimateCost(task, model, cacheAvailable),
      fallbackModel: this.selectFallback(model)
    };
  }

  scoreComplexity(task) {
    let score = 0;

    // Analyze task characteristics
    for (const [factor, weight] of Object.entries(this.complexityWeights)) {
      if (this.taskHasCharacteristic(task, factor)) {
        score += weight;
      }
    }

    // Learn from history
    const historicalComplexity = this.getHistoricalComplexity(task.type);
    if (historicalComplexity) {
      score = (score * 0.7) + (historicalComplexity * 0.3); // Weighted avg
    }

    return Math.max(0, Math.min(10, score)); // Clamp 0-10
  }

  makeSelection(complexity, budgetLevel, cacheProb) {
    // Budget-aware selection
    if (budgetLevel === 'aggressive') {
      // Use cheapest possible
      if (complexity < 4) return this.models.haiku;
      if (complexity < 8) return this.models.sonnet;
      return this.models.opus; // Only for critical
    }

    // Standard selection
    if (complexity <= 2) return this.models.haiku;
    if (complexity <= 7) return this.models.sonnet;
    return this.models.opus;
  }

  async learnFromFeedback(taskId, wasSuccessful, shouldHaveUsed) {
    // Adaptive learning
    const selection = this.usageTracking.selections.find(s => s.taskId === taskId);

    if (selection && !wasSuccessful && shouldHaveUsed) {
      // We under-estimated complexity
      this.usageTracking.corrections.push({
        taskType: selection.taskType,
        selectedModel: selection.model,
        shouldHaveUsed: shouldHaveUsed,
        complexityScore: selection.complexity,
        adjustment: +1 // Increase future complexity scores for this type
      });

      // Update historical data
      this.updateComplexityModel(selection.taskType, +1);
    }

    // Track accuracy
    const accuracy = this.usageTracking.accuracy.get(selection.model) || { correct: 0, total: 0 };
    accuracy.total++;
    if (wasSuccessful) accuracy.correct++;
    this.usageTracking.accuracy.set(selection.model, accuracy);
  }
}
```

### Component 1.3: Cache Manager

**Purpose**: Manage prompt caching for 90% cost reduction on cached content

**Implementation**:
```javascript
class PromptCacheManager {
  constructor() {
    this.cacheStrategy = {
      agent_contexts: {
        ttl: '1-hour',
        sections: ['foundation', 'professional', 'safety', 'memory_system'],
        estimatedSize: 2800, // tokens (78% of 3600)
        hitRate: 0.80        // Target
      },
      project_contexts: {
        ttl: '5-minutes',
        sections: ['structure', 'standards', 'constraints', 'tech_stack'],
        estimatedSize: 8000,
        hitRate: 0.60
      },
      shared_knowledge: {
        ttl: '1-hour',
        sections: ['best_practices', 'code_standards', 'compliance_rules'],
        estimatedSize: 15000,
        hitRate: 0.90
      }
    };

    this.cacheStats = {
      hits: 0,
      misses: 0,
      writes: 0,
      savings: 0 // in tokens
    };
  }

  async buildCachedPrompt(components) {
    const prompt = [];

    // Add cached components with cache_control
    for (const component of components) {
      if (this.shouldCache(component)) {
        prompt.push({
          type: "text",
          text: component.content,
          cache_control: {
            type: "ephemeral",
            ...this.getCacheOptions(component)
          }
        });
      } else {
        // Don't cache dynamic content
        prompt.push({
          type: "text",
          text: component.content
        });
      }
    }

    return prompt;
  }

  shouldCache(component) {
    // Cache if:
    // 1. Content is static or rarely changes
    // 2. Size > minimum threshold (1024 tokens for Sonnet)
    // 3. Expected reuse is high

    return (
      component.changeFrequency === 'static' ||
      component.changeFrequency === 'rare'
    ) && (
      component.tokens >= 1024
    ) && (
      component.reuseCount > 2
    );
  }

  getCacheOptions(component) {
    const strategy = this.cacheStrategy[component.type];
    return {
      ttl: strategy?.ttl || '5-minutes'
    };
  }

  async warmCache(agentIds) {
    // Pre-cache commonly used agents during low-usage periods
    console.log(`🔥 Warming cache for ${agentIds.length} agents...`);

    const results = await Promise.all(
      agentIds.map(async (agentId) => {
        const context = await this.loadAgentContext(agentId);
        const cached = await this.cacheAgentContext(context);
        return { agentId, cached, tokens: context.cacheableTokens };
      })
    );

    const totalTokens = results.reduce((sum, r) => sum + r.tokens, 0);
    console.log(`✅ Cached ${totalTokens.toLocaleString()} tokens for ${agentIds.length} agents`);

    return results;
  }

  trackCachePerformance(request, response) {
    const cached = response.usage?.cache_read_input_tokens || 0;
    const fresh = response.usage?.input_tokens || 0;

    if (cached > 0) {
      this.cacheStats.hits++;
      this.cacheStats.savings += cached * 0.9; // 90% savings on cached tokens
    } else {
      this.cacheStats.misses++;
    }

    // Calculate hit rate
    const total = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate = this.cacheStats.hits / total;

    if (hitRate < 0.60 && total > 50) {
      console.warn(`⚠️  Cache hit rate low: ${(hitRate * 100).toFixed(1)}%`);
      this.suggestCacheOptimizations();
    }

    return {
      cached,
      fresh,
      hitRate,
      totalSavings: this.cacheStats.savings
    };
  }

  suggestCacheOptimizations() {
    // Analyze cache misses and suggest improvements
    const suggestions = [];

    if (this.cacheStats.misses > this.cacheStats.hits) {
      suggestions.push({
        issue: 'High cache miss rate',
        suggestion: 'Consider increasing cache TTL for stable contexts',
        impact: 'Could improve hit rate by 20-30%'
      });
    }

    // More sophisticated analysis...
    return suggestions;
  }
}
```

---

## LAYER 2: INTELLIGENT ORCHESTRATOR

**Model**: Claude Opus 4 (expensive but smart coordinator)

**Purpose**: Central brain that plans, delegates, and synthesizes

```javascript
class IntelligentOrchestrator {
  constructor() {
    this.model = 'claude-3-opus-20240229';
    this.agentDiscovery = new OptimizedAgentDiscovery();
    this.contextManager = new SharedContextManager();
    this.cacheManager = new PromptCacheManager();
    this.modelSelector = new IntelligentModelSelector();
    this.tokenBudget = new TokenBudgetManager();
  }

  async handleRequest(userRequest, context) {
    // Phase 1: Analyze and Plan (Opus)
    const plan = await this.analyzeTAndPlan(userRequest, context);

    // Phase 2: Discover and Allocate Agents (Haiku for discovery)
    const agents = await this.discoverAndAllocateAgents(plan);

    // Phase 3: Prepare Shared Context (Cache it!)
    const sharedContext = await this.prepareSharedContext(plan, agents);

    // Phase 4: Execute Agents in Parallel (Sonnet/Opus as appropriate)
    const results = await this.executeAgentsInParallel(agents, sharedContext, plan);

    // Phase 5: Synthesize and Validate (Opus)
    const final = await this.synthesizeAndValidate(results, plan);

    // Phase 6: Learn and Optimize
    await this.learnFromExecution(plan, agents, results, final);

    return final;
  }

  async analyzeAndPlan(userRequest, context) {
    // Use Opus for high-level planning
    const promptTokens = await this.tokenBudget.requestTokens(5000, {
      phase: 'planning',
      model: 'opus'
    });

    const plan = await this.callClaude({
      model: this.model,
      messages: [{
        role: "user",
        content: this.buildPlanningPrompt(userRequest, context)
      }],
      max_tokens: 2000
    });

    return this.parsePlan(plan);
  }

  async discoverAndAllocateAgents(plan) {
    // Use optimized agent discovery with metadata
    // Uses Haiku for matching (cheap!)
    const agents = await this.agentDiscovery.findOptimalAgents(plan, {
      maxAgents: 5,
      model: 'haiku', // Use Haiku for agent matching
      loadFullContext: false // Just metadata initially
    });

    // Now load only the full contexts we need (with caching!)
    const fullAgents = await Promise.all(
      agents.map(async (agent) => {
        const cached = await this.cacheManager.loadCachedContext(agent.id);
        return {
          ...agent,
          context: cached,
          model: this.modelSelector.selectModel(plan.tasks[agent.id])
        };
      })
    );

    return fullAgents;
  }

  async prepareSharedContext(plan, agents) {
    // Build shared context once, cache it, share with all agents
    const context = await this.contextManager.buildSharedContext({
      project: plan.projectId,
      phase: plan.phase,
      standards: plan.standards,
      constraints: plan.constraints
    });

    // Cache this shared context
    await this.cacheManager.cacheSharedContext(context, {
      ttl: '5-minutes',
      projectId: plan.projectId
    });

    return context;
  }

  async executeAgentsInParallel(agents, sharedContext, plan) {
    // Execute agents in parallel with shared cached context
    const executions = agents.map(async (agent) => {
      try {
        // Each agent gets:
        // 1. Shared context (cached - 90% savings)
        // 2. Their own context (cached - 90% savings)
        // 3. Specific task (small, not cached)

        const result = await this.executeAgent(agent, {
          shared: sharedContext,      // Cached
          agent: agent.context,       // Cached
          task: plan.tasks[agent.id]  // Fresh
        });

        return {
          agent: agent.id,
          success: true,
          result: result,
          tokensUsed: result.usage
        };
      } catch (error) {
        return {
          agent: agent.id,
          success: false,
          error: error,
          needsUpgrade: this.shouldUpgradeModel(error)
        };
      }
    });

    const results = await Promise.all(executions);

    // Handle any failures
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      await this.handleFailures(failures, agents, sharedContext, plan);
    }

    return results.filter(r => r.success);
  }

  async synthesizeAndValidate(results, plan) {
    // Use Opus to synthesize results and validate quality
    const synthesis = await this.callClaude({
      model: 'claude-3-opus-20240229',
      messages: [{
        role: "user",
        content: this.buildSynthesisPrompt(results, plan)
      }],
      max_tokens: 3000
    });

    return synthesis;
  }

  async learnFromExecution(plan, agents, results, final) {
    // Track what worked, what didn't
    // Improve future agent selection
    // Optimize model selection
    // Refine complexity scoring

    const metrics = {
      tokensUsed: results.reduce((sum, r) => sum + r.tokensUsed.total_tokens, 0),
      cost: this.calculateCost(results),
      time: Date.now() - plan.startTime,
      quality: await this.assessQuality(final),
      efficiency: this.calculateEfficiency(results, plan)
    };

    // Store for future optimization
    await this.storeExecutionMetrics(plan.id, metrics);

    // Update agent discovery weights
    await this.agentDiscovery.updateFromFeedback(plan, agents, metrics);

    // Update model selection accuracy
    await this.modelSelector.learnFromFeedback(results, metrics);

    return metrics;
  }
}
```

---

## LAYER 3: OPTIMIZED AGENT DISCOVERY

**Critical Optimization**: Don't load all 119 agents!

```javascript
class OptimizedAgentDiscovery {
  constructor() {
    // Lightweight metadata index (~200 tokens per agent)
    this.agentMetadata = new Map(); // 119 × 200 = 23,800 tokens

    this.technologyMapping = {
      // Technology → Agent IDs mapping
      'react': ['alex-react-ninja', 'aria-typescript-expert'],
      'nodejs': ['maria-nodejs-wizard', 'diego-javascript-guru'],
      // ... etc
    };

    this.categoryIndex = {
      // Category → Agent IDs mapping
      'frontend': [...],
      'backend': [...],
      'database': [...],
      'security': [...],
      'testing': [...],
      'devops': [...]
    };
  }

  async initialize() {
    // Load lightweight metadata only (not full contexts!)
    await this.loadAgentMetadata();
    console.log(`📊 Loaded metadata for ${this.agentMetadata.size} agents`);
    console.log(`   Tokens used: ${this.agentMetadata.size * 200} (vs ${this.agentMetadata.size * 3600} full load)`);
  }

  async loadAgentMetadata() {
    // Load just the essential info for each agent
    const agentDirs = await this.getAgentDirectories();

    for (const dir of agentDirs) {
      const metadata = await this.extractMetadata(dir);
      this.agentMetadata.set(metadata.id, metadata);
    }
  }

  async extractMetadata(agentDir) {
    // Read CLAUDE.md but extract only metadata
    const fullContext = await readFile(`${agentDir}/CLAUDE.md`);

    // Extract just the foundation section (first 30 lines, ~800 tokens)
    // Actually, extract even less - just key facts (~200 tokens)
    return {
      id: this.extractField(fullContext, 'Agent ID'),
      name: this.extractField(fullContext, 'Name'),
      role: this.extractField(fullContext, 'Role'),
      department: this.extractField(fullContext, 'Department'),
      primary: this.extractField(fullContext, 'Primary Focus'),
      secondary: this.extractField(fullContext, 'Secondary Skills'),
      mastered: this.extractField(fullContext, 'Mastered'),
      proficient: this.extractField(fullContext, 'Proficient'),
      // ~200 tokens total
      fullContextPath: `${agentDir}/CLAUDE.md` // Reference to full context
    };
  }

  async findOptimalAgents(plan, options = {}) {
    const maxAgents = options.maxAgents || 5;
    const model = options.model || 'haiku'; // Use Haiku for matching!

    // Step 1: Quick filter using local indexes
    const candidateIds = this.quickFilter(plan);
    console.log(`🔍 Quick filter: ${candidateIds.length} candidates`);

    // Step 2: Use Haiku to intelligently match and rank
    // Only sends metadata for candidates, not full contexts!
    const candidates = candidateIds.map(id => this.agentMetadata.get(id));

    const matches = await this.intelligentMatch(plan, candidates, model);
    console.log(`🎯 Intelligent match: Top ${maxAgents} selected`);

    // Step 3: Load full contexts only for selected agents (with caching!)
    const selected = matches.slice(0, maxAgents);
    const fullAgents = await this.loadFullContexts(selected);

    console.log(`✅ Agent discovery complete:`);
    console.log(`   Candidates considered: ${candidateIds.length}`);
    console.log(`   Metadata tokens: ${candidateIds.length * 200}`);
    console.log(`   Selected agents: ${selected.length}`);
    console.log(`   Full context tokens: ${selected.length * 3600}`);
    console.log(`   Savings vs loading all: ${((119 - selected.length) * 3600).toLocaleString()} tokens`);

    return fullAgents;
  }

  quickFilter(plan) {
    // Use local indexes for initial filtering
    const candidates = new Set();

    // Filter by technology
    for (const tech of plan.technologies) {
      const agentIds = this.technologyMapping[tech.toLowerCase()] || [];
      agentIds.forEach(id => candidates.add(id));
    }

    // Filter by category
    for (const category of plan.categories) {
      const agentIds = this.categoryIndex[category.toLowerCase()] || [];
      agentIds.forEach(id => candidates.add(id));
    }

    // If too many, prioritize by relevance
    if (candidates.size > 20) {
      return this.prioritizeCandidates(Array.from(candidates), plan).slice(0, 20);
    }

    return Array.from(candidates);
  }

  async intelligentMatch(plan, candidates, model) {
    // Use Haiku (cheap!) to intelligently match and rank

    const prompt = this.buildMatchingPrompt(plan, candidates);

    const response = await callClaude({
      model: 'claude-3-haiku-20240307', // Cheap model for matching!
      messages: [{
        role: "user",
        content: prompt
      }],
      max_tokens: 1000
    });

    return this.parseMatchingResponse(response);
  }

  buildMatchingPrompt(plan, candidates) {
    return `
Given this project plan:
${JSON.stringify(plan, null, 2)}

And these candidate agents (metadata only):
${JSON.stringify(candidates, null, 2)}

Select the top 5 most relevant agents and rank them by relevance.
Return as JSON: [{ "agentId": "...", "relevance": 0-100, "rationale": "..." }]
`;
  }

  async loadFullContexts(selectedAgents) {
    // Load full contexts with caching
    return await Promise.all(
      selectedAgents.map(async (agent) => {
        const fullContext = await this.cacheManager.loadCachedAgentContext(agent.id);
        return {
          ...agent,
          fullContext: fullContext
        };
      })
    );
  }
}
```

---

## LAYER 4: SHARED CONTEXT MANAGER

**Purpose**: Build context once, cache it, share with all agents

```javascript
class SharedContextManager {
  constructor() {
    this.cacheManager = new PromptCacheManager();
  }

  async buildSharedContext(options) {
    const { project, phase, standards, constraints } = options;

    // Build shared context sections
    const context = {
      project: await this.getProjectInfo(project),
      phase: await this.getPhaseInfo(phase),
      standards: await this.getCodingStandards(standards),
      constraints: await this.getConstraints(constraints),
      techStack: await this.getTechStack(project),
      architecture: await this.getArchitectureOverview(project)
    };

    // Mark all sections as cacheable
    const cachedContext = await this.cacheManager.buildCachedPrompt([
      { content: context.project, type: 'project', changeFrequency: 'rare', tokens: this.estimateTokens(context.project), reuseCount: 10 },
      { content: context.standards, type: 'standards', changeFrequency: 'static', tokens: this.estimateTokens(context.standards), reuseCount: 50 },
      { content: context.constraints, type: 'constraints', changeFrequency: 'rare', tokens: this.estimateTokens(context.constraints), reuseCount: 20 },
      { content: context.techStack, type: 'tech_stack', changeFrequency: 'rare', tokens: this.estimateTokens(context.techStack), reuseCount: 30 }
    ]);

    return cachedContext;
  }

  async getForAgent(agentId, sharedContext) {
    // Agent gets:
    // 1. Shared context (already cached)
    // 2. Agent-specific context (cached separately)
    // 3. Current task (fresh)

    return {
      shared: sharedContext,  // Cached
      agent: await this.cacheManager.loadCachedAgentContext(agentId), // Cached
      // Task added by orchestrator
    };
  }
}
```

---

## LAYER 5: MONGODB STATE OPTIMIZATION

**Purpose**: Reduce MongoDB query response tokens by 90-95%

```javascript
class OptimizedStateManager extends StateManager {
  constructor(connectionString) {
    super(connectionString);
    this.compressionEnabled = true;
  }

  // Override getProjectState with optimized version
  async getProjectState() {
    if (!this.projectId) return null;

    try {
      // Use projection to return only needed fields
      const [project, states, taskSummary] = await Promise.all([
        this.db.collection('projects').findOne(
          { projectId: this.projectId },
          {
            projection: {
              _id: 0,
              projectId: 1,
              projectName: 1,
              status: 1,
              lastActivity: 1,
              summary: 1,  // Pre-computed summary field
              // fullData stored separately
            }
          }
        ),

        this.db.collection('project_state').find(
          { projectId: this.projectId }
        ).project({
          _id: 0,
          phase: 1,
          status: 1,
          lastUpdated: 1,
          summary: 1  // Pre-computed
        }).toArray(),

        // Get task summary instead of full tasks
        this.db.collection('tasks').aggregate([
          { $match: { projectId: this.projectId } },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              priorities: { $push: '$priority' }
            }
          }
        ]).toArray()
      ]);

      // Return compact representation
      return {
        project: project,
        phases: states,
        taskSummary: this.formatTaskSummary(taskSummary),
        // Full data available via: this.getFullProjectData(projectId)
        fullDataRef: `projects/${this.projectId}/full`
      };
    } catch (error) {
      console.error('❌ Failed to get project state:', error.message);
      return null;
    }
  }

  formatTaskSummary(aggregateResults) {
    // Convert to compact format
    const summary = {
      total: 0,
      byStatus: {},
      byPriority: {}
    };

    for (const group of aggregateResults) {
      const status = group._id;
      const count = group.count;
      summary.total += count;
      summary.byStatus[status] = count;

      // Count priorities
      for (const priority of group.priorities) {
        summary.byPriority[priority] = (summary.byPriority[priority] || 0) + 1;
      }
    }

    return summary;
  }

  // When full data is needed, fetch separately
  async getFullProjectData(projectId) {
    // This is rarely called, only when agents need full context
    return await this.db.collection('projects').findOne({ projectId });
  }
}
```

---

## TOKEN USAGE COMPARISON

### Before Optimization: Project Initialization

```
User Request: "Create e-commerce platform"
  ↓
[1] Development Director: 5k tokens
[2] Project Manager: 5k tokens
[3] Agent Discovery: 428k tokens (ALL 119 AGENTS!)
[4] Selected Agents (5): 18k tokens
[5] MongoDB Queries: 50k tokens
[6] Project Setup: 10k tokens

TOTAL: 516k tokens
COST: $1.55 (at $3/M)
TIME: ~45 seconds
```

### After Optimization: Project Initialization

```
User Request: "Create e-commerce platform"
  ↓
[1] Orchestrator (Opus): 5k tokens
[2] Agent Discovery (Haiku):
    - Metadata only: 24k tokens
    - Intelligent match (Haiku): 2k tokens
    - Selected full contexts (5, cached): 5k tokens (cache hit!)
[3] Shared Context (cached): 3k tokens (cache hit!)
[4] MongoDB Queries (optimized): 5k tokens
[5] Project Setup (Sonnet): 5k tokens

TOTAL: 49k tokens
COST: $0.12 (at mixed rates)
TIME: ~12 seconds (cache hits + Haiku speed)

SAVINGS: 90% tokens, 92% cost, 73% faster!
```

---

## SUCCESS METRICS & TARGETS

### Cost Metrics
- [ ] Token usage: 516k → 49k (90% reduction) ✅
- [ ] Cost per project: $1.55 → $0.12 (92% reduction) ✅
- [ ] Daily cost: $6-10 → $0.50-1 (85-90% reduction) ✅

### Performance Metrics
- [ ] Agent discovery: 30s → 5s (83% faster) ✅
- [ ] Cache hit rate: 0% → 80%+ ✅
- [ ] Model selection: 100% Sonnet → 40% Haiku, 50% Sonnet, 10% Opus ✅

### Quality Metrics
- [ ] Task success rate: Maintained ✅
- [ ] Code quality: Maintained or improved ✅
- [ ] User satisfaction: Improved ✅

---

## IMPLEMENTATION PHASES

### Phase 1: Foundation (Week 1)
- [ ] Token Budget Manager
- [ ] Model Selector
- [ ] Optimized Agent Discovery
- [ ] Usage tracking

### Phase 2: Caching (Week 2)
- [ ] Prompt Cache Manager
- [ ] Cache warming strategies
- [ ] Agent context caching
- [ ] Shared context caching

### Phase 3: Orchestration (Week 3)
- [ ] Intelligent Orchestrator
- [ ] Shared Context Manager
- [ ] Parallel execution
- [ ] MongoDB optimization

### Phase 4: Learning (Week 4)
- [ ] Adaptive model selection
- [ ] Performance monitoring
- [ ] A/B testing framework
- [ ] Continuous optimization

---

**Next**: Detailed implementation plan with specific tickets and milestones.
