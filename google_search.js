const myHeaders = new Headers();
myHeaders.append("X-API-KEY", "84c78f024891c9114a889538b934ab9e956f7812");
myHeaders.append("Content-Type", "application/json");

const raw = JSON.stringify({
  "q": "who is jisoo?"
});

const requestOptions = {
  method: "POST",
  headers: myHeaders,
  body: raw,
  redirect: "follow"
};

// Function to extract text from HTML
function extractText(html) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Function to get page text content
async function getPageText(url) {
  try {
    const response = await fetch(url);
    const html = await response.text();
    return extractText(html);
  } catch (error) {
    return `Error fetching ${url}: ${error.message}`;
  }
}

try {
  const response = await fetch("https://google.serper.dev/search", requestOptions);
  const result = await response.text();
  const searchData = JSON.parse(result);
  
  // Extract links from organic results
  const links = searchData.organic.map(item => item.link);
  
  // Get text content from all links asynchronously
  const pageTexts = await Promise.all(
    links.map(async (link) => {
      const text_data = await getPageText(link);
      return { link, text_data };
    })
  );
  
  console.log(pageTexts);
  
} catch (error) {
  console.error(error);
}