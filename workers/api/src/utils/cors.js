export function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type'
  };
}

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), { ...init, headers: { ...corsHeaders(), 'content-type': 'application/json', ...(init.headers || {}) } });
}


