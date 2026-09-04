/**
 * Retry wrapper for async operations.
 *
 * Wraps a function and retries it on failure up to `maxRetries` times,
 * with optional exponential backoff and custom retryable error checking.
 *
 * @param {Function} fn - Async function to wrap.
 * @param {object} [options] - Configuration options.
 * @param {number} [options.maxRetries=3] - Maximum number of retry attempts.
 * @param {number} [options.baseDelay=100] - Base delay in ms between retries.
 * @param {number} [options.backoffFactor=2] - Multiplier for exponential backoff.
 * @param {Function} [options.shouldRetry] - Predicate (error, attempt) => boolean.
 *                                           Defaults to retrying on any error.
 * @returns {Function} A wrapped function with the same signature as `fn`.
 */
export default function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 100,
    backoffFactor = 2,
    shouldRetry = () => true,
  } = options;

  if (typeof fn !== 'function') {
    throw new TypeError('fn must be a function');
  }
  if (maxRetries < 0) {
    throw new RangeError('maxRetries must be >= 0');
  }
  if (baseDelay < 0) {
    throw new RangeError('baseDelay must be >= 0');
  }
  if (backoffFactor <= 0) {
    throw new RangeError('backoffFactor must be > 0');
  }

  return async function wrapped(...args) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn(...args);
      } catch (err) {
        lastError = err;

        if (attempt >= maxRetries) {
          break;
        }

        if (!shouldRetry(err, attempt)) {
          break;
        }

        if (baseDelay > 0) {
          const delay = baseDelay * Math.pow(backoffFactor, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  };
}