#!/usr/bin/env node

// Google Search Utility - Get top-k search results with just links
// Usage: node google-search.js "your search query" [number_of_results]

async function googleSearch(query, topK = 10) {
  try {
    console.log(`🔍 Searching Google for: "${query}"`);
    console.log(`📊 Requesting top ${topK} results...\n`);
    
    // Use Serper API instead of Google Custom Search API
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      throw new Error('SERPER_API_KEY not set in environment variables');
    }
    
    const myHeaders = new Headers();
    myHeaders.append("X-API-KEY", apiKey);
    myHeaders.append("Content-Type", "application/json");

    const raw = JSON.stringify({
      "q": query
    });

    const requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow"
    };
    
    console.log('🌐 Fetching from Serper API...');
    const response = await fetch("https://google.serper.dev/search", requestOptions);
    
    if (!response.ok) {
      throw new Error(`Serper API error: ${response.status} - ${response.statusText}`);
    }
    
    const data = await response.json();
    const results = data.organic || [];
    
    // Limit results to requested topK
    const limitedResults = results.slice(0, topK);
    
    console.log(`✅ Found ${limitedResults.length} results\n`);
    
    // Display results
    console.log('📋 Top Search Results:');
    console.log('=' .repeat(50));
    
    limitedResults.forEach((item, index) => {
      console.log(`${index + 1}. ${item.title}`);
      console.log(`   🔗 ${item.link}`);
      console.log(`   📝 ${item.snippet?.substring(0, 100)}...`);
      console.log('');
    });
    
    // Return just the links
    const links = limitedResults.map(item => item.link);
    
    console.log('🔗 Links Only:');
    console.log('=' .repeat(30));
    links.forEach((link, index) => {
      console.log(`${index + 1}. ${link}`);
    });
    
    return {
      query,
      totalResults: data.searchInformation?.totalResults || limitedResults.length,
      results: links,
      searchTime: data.searchInformation?.searchTime || 0
    };
    
  } catch (error) {
    console.error('❌ Search failed:', error.message);
    return null;
  }
}


// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('🔍 Google Search Utility');
    console.log('Usage: node google-search.js "your search query" [number_of_results]');
    console.log('');
    console.log('Examples:');
    console.log('  node google-search.js "javascript tutorial"');
    console.log('  node google-search.js "machine learning" 5');
    console.log('  node google-search.js "python programming" 15');
    process.exit(1);
  }
  
  const query = args[0];
  const topK = parseInt(args[1]) || 10;
  
  console.log('🚀 Starting Google Search...\n');
  
  // Use Serper API
  const result = await googleSearch(query, topK);
  
  if (result) {
    console.log('\n📊 Search Summary:');
    console.log(`Query: "${result.query}"`);
    console.log(`Results: ${result.results.length}`);
    if (result.totalResults) {
      console.log(`Total available: ${result.totalResults}`);
    }
    if (result.searchTime) {
      console.log(`Search time: ${result.searchTime}s`);
    }
    console.log(`Method: ${result.method || 'API'}`);
  } else {
    console.log('\n❌ All search methods failed');
    process.exit(1);
  }
}

// Export for use in other files
module.exports = { googleSearch };

// Run if called directly
if (require.main === module) {
  main();
}
