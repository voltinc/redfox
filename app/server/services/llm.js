/* LLM provider boundary.

   Solene uses a real model only when a provider key is present in the
   environment. There is no pretend model: if nothing is configured the caller
   receives { configured: false } and the API answers with local analysis that is
   labelled as such. */

const PROVIDERS = [
  { id: 'openai', env: 'OPENAI_API_KEY', model: process.env.REDFOX_MODEL || 'gpt-4o-mini', label: 'OpenAI' },
  { id: 'anthropic', env: 'ANTHROPIC_API_KEY', model: process.env.REDFOX_MODEL || 'claude-3-5-sonnet-latest', label: 'Anthropic' },
  { id: 'openrouter', env: 'OPENROUTER_API_KEY', model: process.env.REDFOX_MODEL || 'anthropic/claude-3.5-sonnet', label: 'OpenRouter' },
];

export function providerInfo() {
  const provider = PROVIDERS.find((p) => process.env[p.env]);
  if (!provider) return { configured: false, provider: null, model: null };
  return { configured: true, provider: provider.id, label: provider.label, model: provider.model };
}

export async function complete({ system, messages, maxTokens = 1200 }) {
  const info = providerInfo();
  if (!info.configured) throw new Error('No model provider is configured');

  if (info.provider === 'anthropic') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: info.model,
        max_tokens: maxTokens,
        system,
        messages: messages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
      }),
    });
    if (!response.ok) throw new Error(`Anthropic returned HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
    const data = await response.json();
    return data.content?.map((part) => part.text).join('\n') ?? '';
  }

  const base = info.provider === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
  const key = info.provider === 'openrouter' ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY;
  const response = await fetch(base, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: info.model,
      max_tokens: maxTokens,
      messages: [{ role: 'system', content: system }, ...messages.map((m) => ({ role: m.role, content: m.content }))],
    }),
  });
  if (!response.ok) throw new Error(`${info.label} returned HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}
