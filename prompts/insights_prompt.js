// Prompt for generating insights and contrarian takes
export const insightsPrompt = (topic, entities) => {
  return `Topic: ${topic}
Entities: ${entities.join(', ')}
Produce JSON with fields: insights (3-6 bullet strings), takes (2-4 contrarian bullet strings).`;
};

export const insightsSystemPrompt = 'You are ShadowSearch. Be concise and neutral. Return JSON only.';
