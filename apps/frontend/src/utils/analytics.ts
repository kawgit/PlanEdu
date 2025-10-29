export async function track(eventName: string, payload?: Record<string, any>) {
  const data = { event: eventName, ...payload, ts: new Date().toISOString() };

  // Best-effort: try to POST to backend analytics endpoint, otherwise fallback to console.log
  try {
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    // don't block or fail app if endpoint missing
    fetch(`${BACKEND_URL}/api/analytics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(() => {
      // ignore network errors
    });
  } catch (e) {
    // ignore
  }

  // Local fallback for dev/inspection
  // eslint-disable-next-line no-console
  console.log('[analytics]', eventName, payload || {});
}

export default { track };
