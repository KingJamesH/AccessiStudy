class APIService {
  constructor() {
    this.apiKey = null;
    this.model = null;
  }

  async initialize() {
    const config = await ConfigManager.load();
    this.apiKey = config.GEMINI_API_KEY;
    this.model = config.GEMINI_MODEL || 'gemini-2.0-flash-exp';

    if (!this.apiKey) {
      throw new Error('No API key set. Please add GEMINI_API_KEY to config.local.json');
    }
  }

  async callGemini(prompt, context = '') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const fullPrompt = context ? `${context}\n\n${prompt}` : prompt;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: fullPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 500,
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Gemini API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  async summarizeText(text) {
    const prompt = `Please summarize the following text in a clear, concise way that's easy to understand:\n\n${text}`;
    const context = 'Write a simple summary of the text. Do not include any additional information or context and do not use markdown formatting.';
    return this.callGemini(prompt, context);
  }

//   async explainText(text) {
//     const prompt = `Please explain this text in simple terms that are easy to understand:\n\n${text}`;
//     const context = 'You are explaining complex concepts to students with learning disabilities. Use simple language, short sentences, and clear explanations.';
//     return this.callGemini(prompt, context);
//   }

//   async simplifyText(text) {
//     const prompt = `Please rewrite this text using simpler words and shorter sentences:\n\n${text}`;
//     const context = 'You are simplifying text for students with learning disabilities. Use common words, short sentences, and maintain the original meaning.';
//     return this.callGemini(prompt, context);
//   }
}
