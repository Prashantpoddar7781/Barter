// Mock Sentry Crash Reporting Module

export const sentry = {
  captureException: (error: Error | string, context?: any) => {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';

    // Elegant colored console logs
    console.error(
      `%c[Sentry Crash Report] %cCaptured Exception: "${errorMsg}"`,
      "color: #dc2626; font-weight: bold; padding: 2px 4px; background: #fee2e2; rounded: 4px;",
      "color: #1e293b; font-weight: 500;",
      error,
      context || ""
    );

    try {
      const logs = JSON.parse(localStorage.getItem('barter_sentry_logs') || '[]');
      logs.unshift({
        message: errorMsg,
        stack: errorStack,
        context: context || {},
        timestamp: new Date().toISOString()
      });
      // Cap logs at 50 entries
      localStorage.setItem('barter_sentry_logs', JSON.stringify(logs.slice(0, 50)));
    } catch (_) {}
  }
};
