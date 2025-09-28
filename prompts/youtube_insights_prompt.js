// Prompt for generating YouTube-specific insights
export const youtubeInsightsPrompt = (analysis) => {
  return `Based on this video analysis, generate:
1. 3-6 key insights about the content
2. 2-4 contrarian takes or alternative perspectives
3. Educational value assessment
4. Target audience insights

Video Analysis: ${analysis?.result || 'No analysis available'}

Return JSON with fields: insights (array), takes (array), educationalValue (string), targetAudience (string)`;
};
