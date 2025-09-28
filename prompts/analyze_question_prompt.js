// Prompt for analyzing a specific question about a web page
export const analyzeQuestionPrompt = (title, url, text, query) => {
  return `You are analyzing a web page. Title: "${title}". URL: ${url}.
Text content: ${text.slice(0, 4000)}

Question: ${query}

Answer the question based on the page content above. Be clear and concise.`;
};

export const analyzeQuestionSystemPrompt = 'Answer the question based on the provided page content. Be clear and helpful.';
