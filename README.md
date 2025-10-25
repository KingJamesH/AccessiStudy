# WebAble - Accessibility and AI tools to let EVERYONE access the internet 
Around [15% of the US population](https://www.supportivecareaba.com/statistics/learning-disabilities) has a learning disability. Only around [10% of web pages](https://webaim.org/projects/million/) meet basic accessibility standards. 

Introducing: **WebAble**. WebAble is a Google Extension that allows the user to manipulate the visual appearance of any webpage to improve accessibility. It also features AI tools to summarize text and even whole websites to make using the internet easier and more accessible for everyone. While there are some apps and extensions that can help with accessibility, almost all of them only address one aspect, and most of them are complex and hard to use. WebAble is a simple  extension that addresses multiple aspects of accessibility in one spot, helping everyone  better access the web.

## How It's made:
**Tech Used:** HTML, CSS, JavaScript, Chrome Extension API, Gemini 2.0 API

### Accessibility features: How it works  
WebAble uses DOM manipulation to change the appearance of any webpage to improve accessibility. It also uses the Chrome extension API to store user preferences and send messages to the content script. The user can change the following: 

1. Text size, spacing between letters (word spacing), line spacing
2. Dyslexic-friendly font (OpenDyslexic)
3. High contrast mode

All changes are applied once the user clicks the "Apply Accessibility" button. 

### AI features: How it works

WebAble uses the Gemini 2.0 API to generate AI summaries of webpages and text. It also uses the Chrome extension API to store user preferences and send messages to the content script. When selecting a section of text on a web page, the user can right-click and "Summarize selection" to generate a summary of the selected text. The user can also click "Summarize Page" in the extension to generate a summary of the entire webpage.

The summaries are then stored in Chrome's storage API and can be viewed in the by clicking "View AI Summaries" in the extension.

## The future of WebAble:
The next step for WebAble would be implementing a text-to-speech feature. The user would be able to select text on a page and select text-to speech to read the text out loud. This would be especially helpful for students with reading disabilities. I also hope to make the UI cleaner and more compact in the future. 

## Instructions:
### Step 1. Download the extension files from the green code button
**Important:** To use the AI features (page summarization, text summarization), you need to set up your own Google Gemini API key.
### Step 2: Get a Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Create a new API key
4. Copy the API key (keep it secure!)

### Step 3: Configure the Extension
1. Create a file called `config.local.json` in the extension directory
2. Add your API key to the file:

```json
{
    "GEMINI_API_KEY": "YOUR_API_KEY_HERE",
    "GEMINI_MODEL": "gemini-2.0-flash-exp"
}
```
### Step 4: Installing the Extension
1. Go to chrome://extensions/
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the folder containing the extension files