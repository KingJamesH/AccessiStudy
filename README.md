## Inspiration
Around [20% of students](https://ncld.org/wp-content/uploads/2023/07/NCLD_2016%E2%80%932017-Annual-Report-1.pdf) in the US have a learning disability. Only around [10% of web pages](https://webaim.org/projects/million/) meet basic accessibility standards. I created **WebAble** to help students better access the web. While there are some apps and extensions that can help with accessibility, almost all of them only address one aspect, and most of them are complex and somewhat hard to use. WebAble is a simple and easy to use extension that addresses multiple aspects of accessibility in one spot, helping students better access the web.

## What it does
WebAble is an extension designed to **improve the accessibility** of webpages for everyone. It features a modern, intuitive interface with a two-column layout that makes it easy to access both accessibility tools and AI features.

**Accessibility Tools (Left Column):**
- Text size adjustment with live preview
- Word and line spacing customization
- Dyslexic-friendly font toggle (OpenDyslexic)
- High contrast mode toggle
- All changes apply instantly to the current webpage

**AI Assistant (Right Column):**
- **Smart Page Summarization**: Generate AI summaries of entire web pages
- **AI Summary Management**: View, organize, and delete saved summaries
- **One-Click History Clearing**: Remove all AI summaries at once
- **Gemini 2.0 Integration**: Uses Google's latest AI model for accurate summaries

**Modern Design:**
- Clean 800px wide layout with organized columns
- Beautiful gradient styling and smooth animations
- Responsive design that works on all screen sizes
- Intuitive icons and clear labeling

## How we built it

WebAble is built using **HTML, CSS, and JavaScript**. The extension is built using the **Chrome extension API**. All of the accessibility features are injected by manipulating the **Document Object Model (DOM)**. The interface uses collapsible sections for clean organization and stores user preferences using Chrome's storage API.

## Challenges we ran into

WebAble was the **first** extension I built. As a result, I had to learn a lot of new things, including the Chrome Extension API, DOM manipulation, and cross-origin communication. 

## Accomplishments that we're proud of

Despite the challenges I faced during the development of AccessiStudy, I'm still proud of the accessibility features. When I first started, I didn't know how to change the styling of a pre-existing website. Through hours of research, testing, and debugging, I was able to create a result that I was happy about. 

## What we learned
- How to create an extension: This was the first extension I have ever made, and I learned a lot about extension development through this project.
- DOM Manipulation: I learned how to change the styling of a pre-existing website.
- Chrome extension API: I learned how to use the Chrome extension API to store data, send messages, and inject scripts.
- UI/UX Design: I learned the importance of clean, intuitive interfaces and how simplifying navigation can improve user experience.
- CSS Architecture: I gained experience managing CSS specificity and creating maintainable styling systems.

## What's next for WebAble
WebAble now features a comprehensive two-column interface with both accessibility tools and AI features! Future enhancements could include:
- **Text-to-Speech**: Read summaries aloud for users with reading difficulties
- **Annotation Tools**: Highlight and annotate web pages directly
- **Custom AI Prompts**: Allow users to customize how text is summarized
- **Offline Support**: Cache summaries for offline access
- **Multi-language Support**: Summarize content in different languages 

## Using AI Features
1. **Create AI Summaries**: Select text on any webpage → Right-click → "Summarize selection"
2. **Summarize Whole Pages**: Click the WebAble extension icon → Click "📄 Summarize Page" in the AI Assistant column
3. **View Notes**: Click the extension icon → Click "📋 View AI Summaries" in the AI Assistant column
4. **Delete Notes**: Click the 🗑️ button on any note to delete it individually
5. **Clear All**: Click "🗑️ Clear AI History" in the AI Assistant column to delete all summaries at once
6. **Export Notes**: Click "Save Notes File" to download all notes as a text file

## Accessibility Features
- **Text Settings (Left Column)**: Adjust size, word spacing, and line spacing with live preview
- **Display Settings (Left Column)**: Toggle dyslexic-friendly font and high contrast mode
- **Apply Settings (Bottom)**: Apply all accessibility changes to the current webpage
- **Reset to Defaults (Bottom)**: Restore all settings to their original values

**Modern Interface:**
- **Two-Column Layout**: Accessibility tools on the left, AI features on the right
- **800px Wide Design**: Spacious layout that works on all screen sizes
- **Visual Hierarchy**: Clear sections with icons and descriptive labels
- **Smooth Animations**: Hover effects and transitions for better user experience

# Instructions:
### Installing the Extension
1. Download the extension files from the green code button
2. Go to chrome://extensions/
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the folder containing the extension files

## Credits
- https://youtu.be/0n809nd4Zu4
- https://youtu.be/uMsrBz8DKCg
- https://youtu.be/mcfCdFS9VBY
- https://opendyslexic.org/