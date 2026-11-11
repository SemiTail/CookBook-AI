// Loaded only by test processes via --require; production never loads this file.
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  if (String(url).startsWith('https://generativelanguage.googleapis.com/')) {
    const body = JSON.parse(options.body);
    const latest = body.contents.at(-1).parts[0].text;
    if (latest === '__error__') return new Response('{}', { status: 429 });
    if (latest === '__slow__') await new Promise(resolve => setTimeout(resolve, 200));
    const text = latest === '__inspect__' ? JSON.stringify(body) : 'Тестова відповідь Gemini: приготуйте омлет із помідорами.\n1. Наріжте помідор.\n2. Додайте яйця та приготуйте омлет.';
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] });
  }
  return originalFetch(url, options);
};
