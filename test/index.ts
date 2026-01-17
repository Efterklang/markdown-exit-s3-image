import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { MarkdownExit } from 'markdown-exit';
import { image } from '../src/index.js';

const CACHE_FILE = './test/cache.json';
const HTML_OUTPUT = './test/output.html';

async function runMarkdownProcessing(useCache: boolean) {
  const md = new MarkdownExit({
    html: true
  });
  const options = {
    progressive: {
      enable: true,
      srcset_widths: [400, 600, 800]
    },
    lazy: {
      enable: true
    },
    ignore_formats: ['svg'],
    cache_path: useCache ? CACHE_FILE : null
  };

  md.use(image, options);

  const input = readFileSync('./test/test-input.md', 'utf8');
  const startTime = Date.now();
  const result = await md.renderAsync(input);
  const duration = Date.now() - startTime;

  return { result, duration };
}

async function test() {
  try {
    console.log('🧪 Cache Functionality Test');
    console.log('='.repeat(60));

    console.log('\n📝 Running markdown processing...');
    console.log('-'.repeat(60));
    const { result, duration } = await runMarkdownProcessing(true);
    console.log(`⏱️  Duration: ${duration}ms`);

    console.log('\n📝 Checking cache file status...');
    console.log('-'.repeat(60));
    let cacheInfo = 'No cache file';
    if (existsSync(CACHE_FILE)) {
      console.log('✅ Cache file exists');
      const cacheContent = readFileSync(CACHE_FILE, 'utf8');
      const cacheEntries = JSON.parse(cacheContent);
      console.log(`📊 Cache entries: ${Object.keys(cacheEntries).length} images`);
      console.log(`📦 File size: ${cacheContent.length} bytes`);

      cacheInfo = `${Object.keys(cacheEntries).length} cached images`;

      if (Object.keys(cacheEntries).length > 0) {
        const firstKey = Object.keys(cacheEntries)[0];
        const entry = cacheEntries[firstKey];
        console.log(`\n📝 Sample cache entry:`);
        console.log(`   - URL: ${firstKey.substring(0, 50)}...`);
        console.log(`   - Size: ${entry.width}x${entry.height}`);
        console.log(`   - Data URL length: ${entry.dataURL.length} chars`);
      }
    } else {
      console.log('❌ Cache file does not exist');
    }

    const htmlOutput = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Markdown Image Processing - Cache Test</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
        }
        .section {
            margin: 40px 0;
            border: 1px solid #e1e5e9;
            border-radius: 8px;
            overflow: hidden;
        }
        .section-header {
            background: #f8f9fa;
            padding: 12px 20px;
            font-weight: 600;
            border-bottom: 1px solid #e1e5e9;
        }
        .content {
            padding: 20px;
        }
        .stats {
            background: #f0f9ff;
            padding: 16px;
            border-radius: 6px;
            border: 1px solid #bae6fd;
            margin-bottom: 20px;
        }
        .stats h3 {
            margin-top: 0;
            color: #0369a1;
        }
        .stat-item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e0f2fe;
        }
        .stat-item:last-child {
            border-bottom: none;
        }
        .stat-label {
            font-weight: 500;
        }
        .stat-value {
            font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
        }
        .success { color: #059669; }
        .warning { color: #d97706; }
        .info { color: #0369a1; }
        img {
            max-width: 100%;
            height: auto;
        }
        .pic {
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <h1>🧪 Markdown Image Processing - Cache Verification</h1>

    <div class="section">
        <div class="section-header">📊 Test Results</div>
        <div class="content">
            <div class="stats">
                <h3>Performance Metrics</h3>
                <div class="stat-item">
                    <span class="stat-label">Processing Duration</span>
                    <span class="stat-value">${duration}ms</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Cache Status</span>
                    <span class="stat-value ${existsSync(CACHE_FILE) ? 'success' : 'warning'}">${cacheInfo}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Cache File</span>
                    <span class="stat-value">${CACHE_FILE}</span>
                </div>
            </div>
            <p><strong>💡 Cache Testing Instructions:</strong></p>
            <pre style="background: #f6f8fa; padding: 12px; border-radius: 6px; overflow-x: auto;">
1. First run (creates cache):  bun run test
2. Second run (uses cache):   bun run test
3. Compare durations to see speedup
            </pre>
        </div>
    </div>

    <div class="section">
        <div class="section-header">🎯 Processed HTML Output</div>
        <div class="content">
            <div class="html-content">${result}</div>
        </div>
    </div>
</body>
</html>`;

    writeFileSync(HTML_OUTPUT, htmlOutput, 'utf8');
    console.log('\n' + '='.repeat(60));
    console.log('✅ Test completed!');
    console.log(`📁 Open ${HTML_OUTPUT} in your browser to view results`);
    console.log('\n💡 To verify cache speedup:');
    console.log('   1. Run: bun run test  (creates cache, note duration)');
    console.log('   2. Run: bun run test  (uses cache, note duration)');
    console.log('   3. Second run should be faster due to cache hits');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

test();
