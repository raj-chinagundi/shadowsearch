// Prompt for web page analysis to extract topic and entities
export const analyzePrompt = (title, url, text) => {
  return `You are analyzing a web page. Title: "${title}". URL: ${url}.
Text (may be truncated): \n${text.slice(0, 4000)}\n---\nReturn JSON with fields: topic (short string), entities (array of 3-10 key entities or keywords).`;
};

export const analyzeSystemPrompt = 'Return only JSON.';
