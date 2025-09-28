// Prompt for Q&A system using sources
export const qaPrompt = (query, sources) => {
  const lines = sources.map((it, i) => {
    const content = it.content || it.title;
    return `${i+1}. [${it.source}] ${it.title}\n   Content: ${content.slice(0, 500)}${content.length > 500 ? '...' : ''}\n   URL: ${it.url}`;
  }).join('\n\n');
  
  return `Answer the user question using ONLY the sources below. Cite sources by number in brackets, e.g., [1].

Question: ${query}

Sources:
${lines}

Answer:`;
};

export const qaSystemPrompt = 'Answer the question clearly and concisely. Use the provided sources to support your answer. If you reference a source, mention it by number like [1].';
