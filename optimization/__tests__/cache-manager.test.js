/**
 * Prompt Cache Manager Tests
 */

const PromptCacheManager = require('../cache-manager');

describe('PromptCacheManager', () => {
  let cacheManager;

  beforeEach(() => {
    cacheManager = new PromptCacheManager({
      enabled: true,
      maxCacheSize: 50,
      minCacheableSize: 100
    });
  });

  afterEach(() => {
    if (cacheManager) {
      cacheManager.destroy();
    }
  });

  describe('Initialization', () => {
    test('should initialize with default config', () => {
      const manager = new PromptCacheManager();
      expect(manager.config.enabled).toBe(true);
      expect(manager.config.cacheLifetime).toBe(300000); // 5 minutes
      expect(manager.config.maxCacheSize).toBe(100);
      manager.destroy();
    });

    test('should initialize with custom config', () => {
      const manager = new PromptCacheManager({
        enabled: false,
        maxCacheSize: 200,
        minCacheableSize: 500
      });

      expect(manager.config.enabled).toBe(false);
      expect(manager.config.maxCacheSize).toBe(200);
      expect(manager.config.minCacheableSize).toBe(500);

      manager.destroy();
    });
  });

  describe('Content Classification', () => {
    test('should identify static content', () => {
      const systemMessage = { role: 'system', content: 'You are a helpful assistant' };
      const type = cacheManager.classifyContent(systemMessage, {});

      expect(type).toBe('static');
    });

    test('should identify agent contexts as static', () => {
      const agentContext = {
        role: 'user',
        content: '# Agent: Software Developer\n\nCLAUDE.md context...'
      };

      const type = cacheManager.classifyContent(agentContext, {});
      expect(type).toBe('static');
    });

    test('should identify code files as semi-static', () => {
      const codeFile = {
        role: 'user',
        content: 'class MyClass {\n  constructor() {\n    this.value = 42;\n  }\n  getValue() {\n    return this.value;\n  }\n}'
      };

      const type = cacheManager.classifyContent(codeFile, {});
      expect(type).toBe('semiStatic');
    });

    test('should use user-specified content type', () => {
      const message = { role: 'user', content: 'Some content' };
      const type = cacheManager.classifyContent(message, {
        contentType: 'static'
      });

      expect(type).toBe('static');
    });
  });

  describe('Cache Point Identification', () => {
    test('should identify multiple cache points', () => {
      const messages = [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'User message' },
        { role: 'user', content: '# Agent: Test\n\nCLAUDE.md context' }
      ];

      const cachePoints = cacheManager.identifyCachePoints(messages, {});

      expect(cachePoints.length).toBeGreaterThan(0);
      expect(cachePoints[0].type).toBeDefined();
      expect(cachePoints[0].priority).toBeDefined();
    });

    test('should sort cache points by priority', () => {
      const messages = [
        { role: 'user', content: 'Project: Test Project\n\nLong description...' },
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: '# Agent: Developer\n\nCLAUDE.md' }
      ];

      const cachePoints = cacheManager.identifyCachePoints(messages, {});

      // Static content should have priority 1
      expect(cachePoints[0].priority).toBeLessThanOrEqual(cachePoints[cachePoints.length - 1].priority);
    });
  });

  describe('Cache Strategy Determination', () => {
    test('should not cache content that is too small', () => {
      const messages = [{ role: 'user', content: 'Hi' }];

      const strategy = cacheManager.determineCacheStrategy(messages, {});

      expect(strategy.shouldCache).toBe(false);
      expect(strategy.reason).toContain('too small');
    });

    test('should cache large static content', () => {
      const messages = [
        {
          role: 'system',
          content: 'You are a helpful assistant. '.repeat(50) // Make it long enough
        }
      ];

      const strategy = cacheManager.determineCacheStrategy(messages, {});

      expect(strategy.shouldCache).toBe(true);
      expect(strategy.cachePoints.length).toBeGreaterThan(0);
      expect(strategy.estimatedSavings).toBeGreaterThan(0);
    });

    test('should estimate savings correctly', () => {
      const longContent = 'A '.repeat(500); // ~1000 tokens
      const messages = [
        { role: 'system', content: longContent }
      ];

      const strategy = cacheManager.determineCacheStrategy(messages, {});

      expect(strategy.shouldCache).toBe(true);
      // Savings should be ~90% of content size
      expect(strategy.estimatedSavings).toBeGreaterThan(100);
    });
  });

  describe('Cache Control Application', () => {
    test('should add cache_control to identified points', () => {
      const messages = [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'User message' }
      ];

      const strategy = {
        cachePoints: [
          { index: 0, type: 'static', priority: 1, tokens: 100 }
        ]
      };

      const result = cacheManager.applyCacheControl(messages, strategy);

      expect(result[0].cache_control).toBeDefined();
      expect(result[0].cache_control.type).toBe('ephemeral');
      expect(result[1].cache_control).toBeUndefined();
    });

    test('should convert string messages to objects with cache control', () => {
      const messages = ['System prompt', 'User message'];

      const strategy = {
        cachePoints: [
          { index: 0, type: 'static', priority: 1, tokens: 100 }
        ]
      };

      const result = cacheManager.applyCacheControl(messages, strategy);

      expect(result[0]).toHaveProperty('type', 'text');
      expect(result[0]).toHaveProperty('text', 'System prompt');
      expect(result[0]).toHaveProperty('cache_control');
      expect(result[1]).toBe('User message'); // Not modified
    });
  });

  describe('Cache Key Generation', () => {
    test('should generate consistent keys for same content', () => {
      const messages1 = [
        { role: 'system', content: 'Test content' }
      ];

      const messages2 = [
        { role: 'system', content: 'Test content' }
      ];

      const key1 = cacheManager.generateCacheKey(messages1);
      const key2 = cacheManager.generateCacheKey(messages2);

      expect(key1).toBe(key2);
    });

    test('should generate different keys for different content', () => {
      const messages1 = [
        { role: 'system', content: 'Content A' }
      ];

      const messages2 = [
        { role: 'system', content: 'Content B' }
      ];

      const key1 = cacheManager.generateCacheKey(messages1);
      const key2 = cacheManager.generateCacheKey(messages2);

      expect(key1).not.toBe(key2);
    });
  });

  describe('Caching Workflow', () => {
    test('should track cache miss on first access', (done) => {
      const messages = [
        { role: 'system', content: 'System prompt that is long enough to be cached '.repeat(10) }
      ];

      cacheManager.once('cache-miss', (event) => {
        expect(event.cacheKey).toBeDefined();
        expect(event.potentialSavings).toBeGreaterThan(0);
        done();
      });

      cacheManager.prepareCacheableContent(messages);
    });

    test('should track cache hit on second access', (done) => {
      const messages = [
        { role: 'system', content: 'System prompt that is long enough to be cached '.repeat(10) }
      ];

      // First access - cache miss
      cacheManager.prepareCacheableContent(messages);

      // Second access - should be cache hit
      cacheManager.once('cache-hit', (event) => {
        expect(event.cacheKey).toBeDefined();
        expect(event.savings).toBeGreaterThan(0);
        expect(event.totalHits).toBe(1);
        done();
      });

      cacheManager.prepareCacheableContent(messages);
    });

    test('should increment hit counter on repeated access', () => {
      const messages = [
        { role: 'system', content: 'System prompt that is long enough to be cached '.repeat(10) }
      ];

      // Access multiple times
      cacheManager.prepareCacheableContent(messages);
      cacheManager.prepareCacheableContent(messages);
      cacheManager.prepareCacheableContent(messages);

      const stats = cacheManager.getStatistics();

      expect(stats.hits).toBe(2); // First is miss, next 2 are hits
      expect(stats.misses).toBe(1);
    });
  });

  describe('Cache Statistics', () => {
    test('should calculate cache hit rate correctly', () => {
      const messages = [
        { role: 'system', content: 'Cacheable content '.repeat(20) }
      ];

      // 1 miss + 4 hits = 5 total, 80% hit rate
      for (let i = 0; i < 5; i++) {
        cacheManager.prepareCacheableContent(messages);
      }

      const stats = cacheManager.getStatistics();

      expect(stats.hitRate).toBeCloseTo(80, 0);
    });

    test('should track total savings', () => {
      const messages = [
        { role: 'system', content: 'Long cacheable content '.repeat(50) }
      ];

      // Access multiple times to accumulate savings
      cacheManager.prepareCacheableContent(messages);
      cacheManager.prepareCacheableContent(messages);
      cacheManager.prepareCacheableContent(messages);

      const stats = cacheManager.getStatistics();

      expect(stats.totalSavings).toBeGreaterThan(0);
    });
  });

  describe('Cache Eviction', () => {
    test('should evict oldest entries when cache is full', (done) => {
      const smallCache = new PromptCacheManager({
        maxCacheSize: 3,
        minCacheableSize: 10
      });

      // Fill cache beyond capacity
      for (let i = 0; i < 5; i++) {
        const messages = [
          { role: 'system', content: `Content ${i} `.repeat(20) }
        ];
        smallCache.prepareCacheableContent(messages);
      }

      smallCache.once('cache-evicted', (event) => {
        expect(event.cacheKey).toBeDefined();
        expect(event.age).toBeGreaterThanOrEqual(0);
        done();
      });

      // Trigger eviction
      const messages = [
        { role: 'system', content: 'New content '.repeat(20) }
      ];
      smallCache.prepareCacheableContent(messages);

      smallCache.destroy();
    });

    test('should respect max cache size', () => {
      const smallCache = new PromptCacheManager({
        maxCacheSize: 5,
        minCacheableSize: 10
      });

      // Add more items than max
      for (let i = 0; i < 10; i++) {
        const messages = [
          { role: 'system', content: `Content ${i} `.repeat(20) }
        ];
        smallCache.prepareCacheableContent(messages);
      }

      const stats = smallCache.getStatistics();
      expect(stats.cacheSize).toBeLessThanOrEqual(5);

      smallCache.destroy();
    });
  });

  describe('Cache Warming', () => {
    test('should warm cache with provided content', async () => {
      const content = [
        {
          name: 'system-prompt',
          type: 'static',
          messages: [
            { role: 'system', content: 'You are a helpful assistant' }
          ]
        },
        {
          name: 'agent-context',
          type: 'static',
          messages: [
            { role: 'user', content: '# Agent: Developer\n\nCLAUDE.md context...' }
          ]
        }
      ];

      await cacheManager.warmCache(content);

      expect(cacheManager.metadata.cacheableContent.size).toBe(2);
    });
  });

  describe('Cache Maintenance', () => {
    test('should remove expired entries during maintenance', (done) => {
      const fastExpiry = new PromptCacheManager({
        cacheLifetime: 100, // 100ms for testing
        minCacheableSize: 10
      });

      const messages = [
        { role: 'system', content: 'Content '.repeat(20) }
      ];

      fastExpiry.prepareCacheableContent(messages);

      // Wait for expiry
      setTimeout(() => {
        fastExpiry.performMaintenance();

        const stats = fastExpiry.getStatistics();
        expect(stats.cacheSize).toBe(0); // Should be expired

        fastExpiry.destroy();
        done();
      }, 150);
    });
  });

  describe('Disabled Caching', () => {
    test('should pass through messages when disabled', () => {
      const disabled = new PromptCacheManager({ enabled: false });

      const messages = [
        { role: 'system', content: 'Test content' }
      ];

      const result = disabled.prepareCacheableContent(messages);

      // Should return unchanged
      expect(result).toEqual(messages);
      expect(result[0].cache_control).toBeUndefined();

      disabled.destroy();
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty messages array', () => {
      const messages = [];

      const result = cacheManager.prepareCacheableContent(messages);

      expect(result).toEqual([]);
    });

    test('should handle single message', () => {
      const messages = [
        { role: 'system', content: 'Single message '.repeat(30) }
      ];

      const result = cacheManager.prepareCacheableContent(messages);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
    });

    test('should handle mixed string and object messages', () => {
      const messages = [
        'String message '.repeat(30),
        { role: 'user', content: 'Object message '.repeat(30) }
      ];

      const result = cacheManager.prepareCacheableContent(messages);

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
