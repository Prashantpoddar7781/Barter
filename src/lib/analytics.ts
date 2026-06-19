// Mock Analytics Module (Mixpanel / Amplitude)

export const analytics = {
  track: (eventName: string, properties?: any) => {
    // Elegant colored console logs
    console.log(
      `%c[Mixpanel/Amplitude Analytics] %cEvent: "${eventName}"`,
      "color: #4f46e5; font-weight: bold; padding: 2px 4px; background: #e0e7ff; rounded: 4px;",
      "color: #1e293b; font-weight: 500;",
      properties || ""
    );

    try {
      const logs = JSON.parse(localStorage.getItem('barter_analytics_logs') || '[]');
      logs.unshift({
        eventName,
        properties: properties || {},
        timestamp: new Date().toISOString()
      });
      // Cap logs at 100 entries
      localStorage.setItem('barter_analytics_logs', JSON.stringify(logs.slice(0, 100)));
    } catch (_) {}
  }
};
