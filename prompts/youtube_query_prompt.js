// Prompts for generating YouTube search queries
export const youtubeQueryUserPrompt = (userQuery, topic) => {
  return `User Query: ${userQuery}
Topic Context: ${topic}

YouTube keywords:`;
};

export const youtubeQueryUserSystemPrompt = 'Generate 2-4 short YouTube search keywords based on the user query. Return only keywords separated by spaces, no sentences or punctuation.';

export const youtubeQueryTopicPrompt = (topic, pageContent) => {
  return `Topic: ${topic}
Content: ${pageContent.slice(0, 500)}

Keywords:`;
};

export const youtubeQueryTopicSystemPrompt = 'Generate 2-4 short YouTube search keywords based on the main topic. Return only keywords separated by spaces, no sentences or punctuation.';
