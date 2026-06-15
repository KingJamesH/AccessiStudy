# WebAble - Accessibility tools to let EVERYONE access the internet 
Around [15% of the US population](https://www.supportivecareaba.com/statistics/learning-disabilities) has a learning disability. Only around [5% of the top 1,000,000 web pages](https://webaim.org/projects/million/) meet basic accessibility standards. 

Introducing: **WebAble**. WebAble is a Chrome extension that enhances web accessibility by allowing users to customize web page appearance, making the internet easier to navigate for people with learning, cognitive, and visual disabilities. While there are some apps and extensions that can help with accessibility, almost all of them only address one aspect, and most of them are complex and hard to use. WebAble is a simple extension that addresses multiple aspects of accessibility in one spot, helping everyone better access the web.

## How It's made:
**Tech Used:** HTML, CSS, JavaScript, Chrome Extension API

### Accessibility features: How it works  
WebAble uses DOM manipulation to change the appearance of any webpage to improve accessibility. It also uses the Chrome extension API to store user preferences and send messages to the content script. The user can change the following: 

1. Text size, spacing between letters (word spacing), line spacing
2. Dyslexia-friendly font (OpenDyslexic)
3. High contrast mode

All changes are applied once the user clicks the "Apply Accessibility" button. 

## The future of WebAble:
The next step for WebAble would be implementing a text-to-speech feature. The user would be able to select text on a page and select text-to speech to read the text out loud. This would be especially helpful for students with reading disabilities. I also hope to make the UI cleaner and more compact in the future. 

## Repository structure
- `extension/` — the Chrome extension (load this folder unpacked)
- `landing/` — the marketing website (home page + privacy policy)

## Instructions:
### Step 1. Download the extension files
### Step 2: Installing the Extension
1. Go to chrome://extensions/
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/` folder

## Deploying the website (Vercel)
The site in `landing/` is a static site (no build step). Because it lives in a
subfolder, point Vercel at it via the project's **Root Directory** setting.

**Option A — Git integration (recommended):**
1. Push this repo to GitHub.
2. In Vercel: **New Project → import `jameshou28/WebAble`**.
3. Set **Root Directory** to `landing`.
4. **Framework Preset:** Other. Leave Build Command and Output Directory empty.
5. Deploy. Every push to the default branch redeploys automatically.

**Option B — Vercel CLI:**
```bash
cd landing
vercel        # preview deploy
vercel --prod # production deploy
```

`landing/vercel.json` handles the rest: clean URLs (`/privacy` instead of
`/privacy.html`), security headers, and long-lived caching for `assets/`.