/**
 * Agent Context Cache Tests
 */

const AgentContextCache = require('../agent-context-cache');
const fs = require('fs').promises;
const path = require('path');

// Mock fs
jest.mock('fs').promises;

describe('AgentContextCache', () => {
  let cache;
  const testAgentDir = '/test/agents';

  beforeEach(() => {
    cache = new AgentContextCache({
      agentDirectory: testAgentDir,
      watchForChanges: false, // Disable for tests
      maxCachedAgents: 10
    });

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (cache) {
      cache.destroy();
    }
  });

  describe('Initialization', () => {
    test('should initialize with default config', () => {
      const defaultCache = new AgentContextCache();

      expect(defaultCache.config.maxCachedAgents).toBe(50);
      expect(defaultCache.config.cacheLifetime).toBe(300000);

      defaultCache.destroy();
    });

    test('should initialize with custom config', () => {
      const customCache = new AgentContextCache({
        maxCachedAgents: 100,
        cacheLifetime: 600000
      });

      expect(customCache.config.maxCachedAgents).toBe(100);
      expect(customCache.config.cacheLifetime).toBe(600000);

      customCache.destroy();
    });
  });

  describe('Cache Key Generation', () => {
    test('should generate consistent cache keys', () => {
      const key1 = cache.generateCacheKey('test-agent');
      const key2 = cache.generateCacheKey('test-agent');

      expect(key1).toBe(key2);
    });

    test('should generate different keys for different agents', () => {
      const key1 = cache.generateCacheKey('agent-1');
      const key2 = cache.generateCacheKey('agent-2');

      expect(key1).not.toBe(key2);
    });

    test('should use agent: prefix', () => {
      const key = cache.generateCacheKey('test-agent');

      expect(key).toContain('agent:');
    });
  });

  describe('Content Hashing', () => {
    test('should generate consistent hashes', () => {
      const content = '# Agent: Test\n\nSome content';
      const hash1 = cache.hashContent(content);
      const hash2 = cache.hashContent(content);

      expect(hash1).toBe(hash2);
    });

    test('should generate different hashes for different content', () => {
      const content1 = 'Content A';
      const content2 = 'Content B';

      const hash1 = cache.hashContent(content1);
      const hash2 = cache.hashContent(content2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Metadata Parsing', () => {
    test('should extract agent title', () => {
      const content = '# Senior Full-Stack Developer\n\nContent...';
      const metadata = cache.parseAgentMetadata(content);

      expect(metadata.title).toBe('Senior Full-Stack Developer');
    });

    test('should extract role', () => {
      const content = '**Role**: Backend Developer\n\nContent...';
      const metadata = cache.parseAgentMetadata(content);

      expect(metadata.role).toBe('Backend Developer');
    });

    test('should extract primary focus', () => {
      const content = '**Primary Focus**: API Development\n\nContent...';
      const metadata = cache.parseAgentMetadata(content);

      expect(metadata.primaryFocus).toBe('API Development');
    });

    test('should handle missing metadata fields', () => {
      const content = 'Just some content without metadata';
      const metadata = cache.parseAgentMetadata(content);

      expect(metadata.title).toBeUndefined();
      expect(metadata.role).toBeUndefined();
    });
  });

  describe('Loading from File', () => {
    test('should load agent context from file', async () => {
      const agentContent = '# Agent: Test\n\n**Role**: Developer\n\nContext content...';

      fs.readFile.mockResolvedValue(agentContent);

      const context = await cache.loadFromFile('test-agent');

      expect(context.agentId).toBe('test-agent');
      expect(context.content).toBe(agentContent);
      expect(context.estimatedTokens).toBeGreaterThan(0);
      expect(context.metadata).toBeDefined();
      expect(context.fileHash).toBeDefined();
    });

    test('should throw error if file cannot be read', async () => {
      fs.readFile.mockRejectedValue(new Error('File not found'));

      await expect(cache.loadFromFile('nonexistent-agent'))
        .rejects
        .toThrow('Failed to load agent nonexistent-agent');
    });

    test('should estimate tokens correctly', async () => {
      const agentContent = 'A'.repeat(1000); // 1000 chars = ~250 tokens

      fs.readFile.mockResolvedValue(agentContent);

      const context = await cache.loadFromFile('test-agent');

      expect(context.estimatedTokens).toBe(250);
    });
  });

  describe('Caching Workflow', () => {
    test('should cache context after loading', async () => {
      const agentContent = '# Agent: Test\n\nContent...';
      fs.readFile.mockResolvedValue(agentContent);

      await cache.loadAgentContext('test-agent');

      const cacheKey = cache.generateCacheKey('test-agent');
      expect(cache.agentCache.has(cacheKey)).toBe(true);
    });

    test('should track cache miss on first load', async (done) => {
      const agentContent = '# Agent: Test\n\nContent...';
      fs.readFile.mockResolvedValue(agentContent);

      cache.once('cache-miss', (event) => {
        expect(event.agentId).toBe('test-agent');
        expect(event.contextSize).toBeGreaterThan(0);
        done();
      });

      await cache.loadAgentContext('test-agent');
    });

    test('should track cache hit on second load', async (done) => {
      const agentContent = '# Agent: Test\n\nContent...';
      fs.readFile.mockResolvedValue(agentContent);

      // First load
      await cache.loadAgentContext('test-agent');

      // Second load - should hit cache
      cache.once('cache-hit', (event) => {
        expect(event.agentId).toBe('test-agent');
        expect(event.estimatedSavings).toBeGreaterThan(0);
        expect(event.hitCount).toBe(1);
        done();
      });

      await cache.loadAgentContext('test-agent');
    });

    test('should return cached context on subsequent loads', async () => {
      const agentContent = '# Agent: Test\n\nLong content...'.repeat(10);
      fs.readFile.mockResolvedValue(agentContent);

      // First load
      const context1 = await cache.loadAgentContext('test-agent');
      expect(context1.fromCache).toBeUndefined();

      // Second load - from cache
      const context2 = await cache.loadAgentContext('test-agent');
      expect(context2.fromCache).toBe(true);
      expect(context2.cacheAge).toBeGreaterThanOrEqual(0);
    });

    test('should not call fs.readFile on cache hit', async () => {
      const agentContent = '# Agent: Test\n\nContent...';
      fs.readFile.mockResolvedValue(agentContent);

      // First load
      await cache.loadAgentContext('test-agent');
      expect(fs.readFile).toHaveBeenCalledTimes(1);

      // Second load - should not call readFile
      await cache.loadAgentContext('test-agent');
      expect(fs.readFile).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe('Statistics Tracking', () => {
    test('should track cache hits and misses', async () => {
      const agentContent = '# Agent: Test\n\nContent...';
      fs.readFile.mockResolvedValue(agentContent);

      // 1 miss + 2 hits
      await cache.loadAgentContext('test-agent');
      await cache.loadAgentContext('test-agent');
      await cache.loadAgentContext('test-agent');

      const stats = cache.getStatistics();

      expect(stats.cacheMisses).toBe(1);
      expect(stats.cacheHits).toBe(2);
      expect(stats.hitRate).toBeCloseTo(66.7, 0);
    });

    test('should track tokens saved', async () => {
      const agentContent = 'A'.repeat(4000); // ~1000 tokens
      fs.readFile.mockResolvedValue(agentContent);

      // First load (miss) + Second load (hit, 90% savings)
      await cache.loadAgentContext('test-agent');
      await cache.loadAgentContext('test-agent');

      const stats = cache.getStatistics();

      expect(stats.tokensSaved).toBeGreaterThan(800); // ~900 tokens saved
    });

    test('should track most used agents', async () => {
      const agentContent = '# Agent: Test\n\nContent...';
      fs.readFile.mockResolvedValue(agentContent);

      // Load same agent multiple times
      for (let i = 0; i < 5; i++) {
        await cache.loadAgentContext('test-agent');
      }

      const stats = cache.getStatistics();

      expect(stats.topAgents).toBeDefined();
      expect(stats.topAgents.length).toBeGreaterThan(0);
      expect(stats.topAgents[0].agentId).toBe('test-agent');
      expect(stats.topAgents[0].usageCount).toBe(4); // First is miss, 4 hits
    });
  });

  describe('Bulk Loading', () => {
    test('should load multiple agents in parallel', async () => {
      fs.readFile.mockImplementation((filePath) => {
        const agentId = path.basename(path.dirname(filePath));
        return Promise.resolve(`# Agent: ${agentId}\n\nContent...`);
      });

      const agentIds = ['agent-1', 'agent-2', 'agent-3'];
      const contexts = await cache.loadMultipleAgents(agentIds);

      expect(contexts.length).toBe(3);
      expect(contexts[0].agentId).toBe('agent-1');
      expect(contexts[1].agentId).toBe('agent-2');
      expect(contexts[2].agentId).toBe('agent-3');
    });

    test('should emit bulk-load event', async (done) => {
      fs.readFile.mockResolvedValue('# Agent: Test\n\nContent...');

      cache.once('bulk-load', (event) => {
        expect(event.count).toBe(2);
        expect(event.cacheMisses).toBe(2);
        expect(event.cacheHits).toBe(0);
        done();
      });

      await cache.loadMultipleAgents(['agent-1', 'agent-2']);
    });

    test('should use cache for previously loaded agents in bulk', async () => {
      fs.readFile.mockResolvedValue('# Agent: Test\n\nContent...');

      // Pre-load one agent
      await cache.loadAgentContext('agent-1');

      // Bulk load including pre-loaded agent
      const contexts = await cache.loadMultipleAgents(['agent-1', 'agent-2']);

      expect(contexts[0].fromCache).toBe(true);
      expect(contexts[1].fromCache).toBeUndefined();
    });
  });

  describe('Cache Warming', () => {
    test('should warm cache with provided agents', async () => {
      fs.readFile.mockResolvedValue('# Agent: Test\n\nContent...');

      const warmed = await cache.warmCache(['agent-1', 'agent-2', 'agent-3']);

      expect(warmed.length).toBe(3);
      expect(cache.agentCache.size).toBe(3);
    });

    test('should emit cache-warmed event', async (done) => {
      fs.readFile.mockResolvedValue('# Agent: Test\n\nContent...');

      cache.once('cache-warmed', (event) => {
        expect(event.requested).toBe(2);
        expect(event.loaded).toBe(2);
        done();
      });

      await cache.warmCache(['agent-1', 'agent-2']);
    });

    test('should handle errors during warming gracefully', async () => {
      fs.readFile.mockImplementation((filePath) => {
        const agentId = path.basename(path.dirname(filePath));
        if (agentId === 'agent-2') {
          return Promise.reject(new Error('File not found'));
        }
        return Promise.resolve('# Agent: Test\n\nContent...');
      });

      const warmed = await cache.warmCache(['agent-1', 'agent-2', 'agent-3']);

      expect(warmed.length).toBe(2); // agent-2 failed
      expect(warmed).toContain('agent-1');
      expect(warmed).not.toContain('agent-2');
    });
  });

  describe('Cache Invalidation', () => {
    test('should invalidate specific agent', async () => {
      fs.readFile.mockResolvedValue('# Agent: Test\n\nContent...');

      await cache.loadAgentContext('test-agent');
      expect(cache.agentCache.size).toBe(1);

      cache.invalidate('test-agent');
      expect(cache.agentCache.size).toBe(0);
    });

    test('should emit cache-invalidated event', async (done) => {
      fs.readFile.mockResolvedValue('# Agent: Test\n\nContent...');

      await cache.loadAgentContext('test-agent');

      cache.once('cache-invalidated', (event) => {
        expect(event.agentId).toBe('test-agent');
        done();
      });

      cache.invalidate('test-agent');
    });

    test('should not error when invalidating non-cached agent', () => {
      expect(() => cache.invalidate('nonexistent-agent')).not.toThrow();
    });
  });

  describe('Cache Eviction', () => {
    test('should evict least used agents when cache is full', async () => {
      const smallCache = new AgentContextCache({
        agentDirectory: testAgentDir,
        maxCachedAgents: 3,
        watchForChanges: false
      });

      fs.readFile.mockImplementation((filePath) => {
        const agentId = path.basename(path.dirname(filePath));
        return Promise.resolve(`# Agent: ${agentId}\n\nContent...`);
      });

      // Load 5 agents (more than max)
      for (let i = 1; i <= 5; i++) {
        await smallCache.loadAgentContext(`agent-${i}`);
      }

      const stats = smallCache.getStatistics();
      expect(stats.cacheSize).toBeLessThanOrEqual(3);

      smallCache.destroy();
    });

    test('should emit cache-evicted event', async (done) => {
      const smallCache = new AgentContextCache({
        agentDirectory: testAgentDir,
        maxCachedAgents: 2,
        watchForChanges: false
      });

      fs.readFile.mockResolvedValue('# Agent: Test\n\nContent...');

      smallCache.once('cache-evicted', (event) => {
        expect(event.agentId).toBeDefined();
        expect(event.hitCount).toBeGreaterThanOrEqual(0);
        done();
      });

      await smallCache.loadAgentContext('agent-1');
      await smallCache.loadAgentContext('agent-2');
      await smallCache.loadAgentContext('agent-3'); // Triggers eviction

      smallCache.destroy();
    });
  });

  describe('Cache Expiration', () => {
    test('should detect expired cache entries', async () => {
      const fastExpiry = new AgentContextCache({
        agentDirectory: testAgentDir,
        cacheLifetime: 100, // 100ms
        watchForChanges: false
      });

      fs.readFile.mockResolvedValue('# Agent: Test\n\nContent...');

      await fastExpiry.loadAgentContext('test-agent');

      const cacheKey = fastExpiry.generateCacheKey('test-agent');
      const entry = fastExpiry.agentCache.get(cacheKey);

      // Should not be expired immediately
      expect(fastExpiry.isCacheExpired(entry)).toBe(false);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(fastExpiry.isCacheExpired(entry)).toBe(true);

      fastExpiry.destroy();
    });

    test('should reload from file when cache is expired', async () => {
      const fastExpiry = new AgentContextCache({
        agentDirectory: testAgentDir,
        cacheLifetime: 100,
        watchForChanges: false
      });

      fs.readFile.mockResolvedValue('# Agent: Test\n\nContent...');

      // First load
      await fastExpiry.loadAgentContext('test-agent');
      expect(fs.readFile).toHaveBeenCalledTimes(1);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Second load after expiration - should reload
      await fastExpiry.loadAgentContext('test-agent');
      expect(fs.readFile).toHaveBeenCalledTimes(2);

      fastExpiry.destroy();
    });
  });

  describe('Edge Cases', () => {
    test('should handle agent without directory configured', async () => {
      const noDir = new AgentContextCache({
        watchForChanges: false
      });

      await expect(noDir.loadAgentContext('test-agent'))
        .rejects
        .toThrow('Agent directory not configured');

      noDir.destroy();
    });

    test('should handle empty agent content', async () => {
      fs.readFile.mockResolvedValue('');

      const context = await cache.loadAgentContext('empty-agent');

      expect(context.content).toBe('');
      expect(context.estimatedTokens).toBe(0);
    });
  });
});
