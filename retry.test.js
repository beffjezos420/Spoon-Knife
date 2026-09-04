import withRetry from './retry.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

async function assertRejects(fn, expectedMessage) {
  try {
    await fn();
    throw new Error('Expected function to throw, but it succeeded');
  } catch (err) {
    if (expectedMessage && !err.message.includes(expectedMessage)) {
      throw new Error(
        `Expected error message to include "${expectedMessage}", got "${err.message}"`
      );
    }
  }
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

async function run() {
  console.log('retry wrapper tests\n');

  await test('retries on failure and eventually succeeds', async () => {
    let callCount = 0;
    const fn = withRetry(async () => {
      callCount++;
      if (callCount < 3) throw new Error('not yet');
      return 'success';
    }, { maxRetries: 3, baseDelay: 5 });

    const result = await fn();
    assert(result === 'success', 'Expected "success"');
    assert(callCount === 3, `Expected 3 calls, got ${callCount}`);
  });

  await test('throws after exhausting retries', async () => {
    let callCount = 0;
    const fn = withRetry(async () => {
      callCount++;
      throw new Error('always fail');
    }, { maxRetries: 2, baseDelay: 5 });

    await assertRejects(() => fn(), 'always fail');
    assert(callCount === 3, `Expected 3 calls (initial + 2 retries), got ${callCount}`);
  });

  await test('does not retry when shouldRetry returns false', async () => {
    let callCount = 0;
    const fn = withRetry(async () => {
      callCount++;
      throw new Error('fatal');
    }, {
      maxRetries: 3,
      baseDelay: 5,
      shouldRetry: (err) => !err.message.includes('fatal'),
    });

    await assertRejects(() => fn(), 'fatal');
    assert(callCount === 1, `Expected 1 call, got ${callCount}`);
  });

  await test('returns immediately on success', async () => {
    let callCount = 0;
    const fn = withRetry(async () => {
      callCount++;
      return 'ok';
    }, { maxRetries: 3, baseDelay: 5 });

    const result = await fn();
    assert(result === 'ok', 'Expected "ok"');
    assert(callCount === 1, `Expected 1 call, got ${callCount}`);
  });

  await test('validates fn argument', async () => {
    await assertRejects(() => withRetry('not a function'), 'fn must be a function');
  });

  await test('validates maxRetries range', async () => {
    await assertRejects(
      () => withRetry(async () => {}, { maxRetries: -1 }),
      'maxRetries must be >= 0'
    );
  });

  await test('validates baseDelay range', async () => {
    await assertRejects(
      () => withRetry(async () => {}, { baseDelay: -1 }),
      'baseDelay must be >= 0'
    );
  });

  await test('validates backoffFactor range', async () => {
    await assertRejects(
      () => withRetry(async () => {}, { backoffFactor: 0 }),
      'backoffFactor must be > 0'
    );
  });

  await test('zero maxRetries means no retry', async () => {
    let callCount = 0;
    const fn = withRetry(async () => {
      callCount++;
      throw new Error('fail');
    }, { maxRetries: 0, baseDelay: 5 });

    await assertRejects(() => fn(), 'fail');
    assert(callCount === 1, `Expected 1 call, got ${callCount}`);
  });

  await test('zero baseDelay skips delay', async () => {
    let callCount = 0;
    const fn = withRetry(async () => {
      callCount++;
      if (callCount < 3) throw new Error('not yet');
      return 'done';
    }, { maxRetries: 3, baseDelay: 0 });

    const result = await fn();
    assert(result === 'done', 'Expected "done"');
    assert(callCount === 3, `Expected 3 calls, got ${callCount}`);
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed${failed > 0 ? ' ✗' : ' ✓'}`);
  const exitCode = failed > 0 ? 1 : 0;
  if (typeof process !== 'undefined') {
    process.exit(exitCode);
  }
}

run();