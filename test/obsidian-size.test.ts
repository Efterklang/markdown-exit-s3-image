import { parseObsidianImageAlt } from '../src/index.js';

function testParseObsidianImageAlt() {
  console.log('\n🧪 Testing parseObsidianImageAlt function');
  console.log('-'.repeat(60));

  const testCases = [
    {
      input: 'Alt text',
      expected: { alt: 'Alt text', width: undefined, height: undefined },
      description: 'Standard alt text without dimensions'
    },
    {
      input: 'Alt text|300',
      expected: { alt: 'Alt text', width: 300, height: undefined },
      description: 'Alt text with width only'
    },
    {
      input: 'Alt text|640x480',
      expected: { alt: 'Alt text', width: 640, height: 480 },
      description: 'Alt text with width and height'
    },
    {
      input: 'My Image|100x200',
      expected: { alt: 'My Image', width: 100, height: 200 },
      description: 'Alt text with spaces and dimensions'
    },
    {
      input: 'image|800x600',
      expected: { alt: 'image', width: 800, height: 600 },
      description: 'Single word alt text with dimensions'
    },
    {
      input: 'spaced alt|500',
      expected: { alt: 'spaced alt', width: 500, height: undefined },
      description: 'Alt text with spaces before pipe'
    },
    {
      input: 'Large number|2048x1536',
      expected: { alt: 'Large number', width: 2048, height: 1536 },
      description: 'Large dimension values'
    },
    {
      input: 'No dimensions here',
      expected: { alt: 'No dimensions here', width: undefined, height: undefined },
      description: 'Alt text without pipe symbol'
    },
    {
      input: 'Invalid|abc',
      expected: { alt: 'Invalid|abc', width: undefined, height: undefined },
      description: 'Invalid width (not a number)'
    },
    {
      input: 'Partial|300xabc',
      expected: { alt: 'Partial|300xabc', width: undefined, height: undefined },
      description: 'Invalid height (not a number)'
    },
    {
      input: '|300',
      expected: { alt: '', width: 300, height: undefined },
      description: 'Empty alt text with width'
    },
    {
      input: '|800x600',
      expected: { alt: '', width: 800, height: 600 },
      description: 'Empty alt text with width and height'
    },
    {
      input: 'Single pixel|1x1',
      expected: { alt: 'Single pixel', width: 1, height: 1 },
      description: 'Minimum dimension values'
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const result = parseObsidianImageAlt(testCase.input);
    const success =
      result.alt === testCase.expected.alt &&
      result.width === testCase.expected.width &&
      result.height === testCase.expected.height;

    if (success) {
      passed++;
      console.log(`✅ ${testCase.description}`);
    } else {
      failed++;
      console.log(`❌ ${testCase.description}`);
      console.log(`   Input: "${testCase.input}"`);
      console.log(`   Expected: ${JSON.stringify(testCase.expected)}`);
      console.log(`   Got: ${JSON.stringify(result)}`);
    }
  }

  console.log('\n' + '-'.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));

  return { passed, failed };
}

async function testMarkdownRendering() {
  console.log('\n🧪 Testing Markdown Rendering with Obsidian Syntax');
  console.log('-'.repeat(60));

  const { MarkdownExit } = await import('markdown-exit');
  const { image } = await import('../src/index.js');

  const md = new MarkdownExit({ html: true });
  md.use(image, {
    progressive: { enable: false },
    bitiful_domains: ['demo.bitiful.com'],
    ignore_formats: ['svg']
  });

  const testCases: Array<{
    input: string;
    shouldContain?: string[];
    shouldNotContain?: string[];
    description: string;
  }> = [
    {
      input: '![Alt text|300](https://demo.bitiful.com/girl.jpeg)',
      shouldContain: ['max-width: 300px', 'width: 300px'],
      shouldNotContain: ['height:'],
      description: 'Image with width only'
    },
    {
      input: '![Alt text|300x200](https://demo.bitiful.com/girl.jpeg)',
      shouldContain: ['max-width: 300px', 'width: 300px', 'height: 200px'],
      description: 'Image with width and height'
    },
    {
      input: '![Standard alt](https://demo.bitiful.com/girl.jpeg)',
      shouldNotContain: ['max-width:', 'width:'],
      description: 'Image without dimensions (should not have inline styles)'
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    try {
      const result = await md.renderAsync(testCase.input);

      let success = true;
      const errors: string[] = [];

      // Check should contain
      if (testCase.shouldContain) {
        for (const str of testCase.shouldContain) {
          if (!result.includes(str)) {
            success = false;
            errors.push(`Missing: "${str}"`);
          }
        }
      }

      // Check should not contain
      if (testCase.shouldNotContain) {
        for (const str of testCase.shouldNotContain) {
          if (result.includes(str)) {
            success = false;
            errors.push(`Unexpected: "${str}"`);
          }
        }
      }

      if (success) {
        passed++;
        console.log(`✅ ${testCase.description}`);
      } else {
        failed++;
        console.log(`❌ ${testCase.description}`);
        console.log(`   Input: ${testCase.input}`);
        console.log(`   Errors: ${errors.join(', ')}`);
        console.log(`   Output: ${result.substring(0, 200)}...`);
      }
    } catch (error) {
      failed++;
      console.log(`❌ ${testCase.description} - Error: ${error.message}`);
    }
  }

  console.log('\n' + '-'.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));

  return { passed, failed };
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Obsidian Image Size Tests');
  console.log('='.repeat(60));

  const unitResults = testParseObsidianImageAlt();
  const renderResults = await testMarkdownRendering();

  const totalPassed = unitResults.passed + renderResults.passed;
  const totalFailed = unitResults.failed + renderResults.failed;
  const totalTests = totalPassed + totalFailed;

  console.log('\n' + '='.repeat(60));
  console.log('📊 Final Test Summary');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`✅ Passed: ${totalPassed}`);
  console.log(`❌ Failed: ${totalFailed}`);

  if (totalFailed === 0) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed.');
    process.exit(1);
  }
}

runTests();
