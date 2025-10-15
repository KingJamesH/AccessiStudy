## Inspiration
Around [20% of students](https://ncld.org/wp-content/uploads/2023/07/NCLD_2016%E2%80%932017-Annual-Report-1.pdf) in the US have a learning disability. Only around [10% of web pages](https://webaim.org/projects/million/) meet basic accessibility standards. I created AccessiStudy to help students better access the web. While there are some apps and extensions that can help with accessibility, almost all of them only address one aspect, and most of them are complex and somewhat hard to use. AccessiStudy is a simple and easy to use extension that addresses multiple aspects of accessibility in one spot, helping students better access the web.

## What it does
AccessiStudy is an extension meant to **improve the accessibility** of webpages. It allows users to apply accessibility features to the current webpage with the click of a button. It can modify text size, spacing between letters, line spacing, and even apply a dyslexic-friendly font and high contrast mode to the webpage. Additionally, it can generate a summary of the webpage using the Gemini 1.5 Flash 8b Model. These summaries can help users to better understand the content of the webpage. 



## How we built it

AccessiStudy is built using **HTML, CSS, and JavaScript**. The extension is built using the **Chrome extension API**. All of the accessibility features are injected by manipulating the **Document Object Model (DOM)**. It uses the **Gemini API** to access the Gemini 1.5 Flash 8b Model.

## Challenges we ran into

AccessiStudy was the **first** extension I built. As a result, I had to learn a lot of new things, including the Chrome Extension API. 

Originally, I aimed to include annotation tools in the extension, but I ran into some difficulty with editting the page. Due to time constraints, I removed this feature and replaced it with the notes function. 

## Accomplishments that we're proud of

Despite the challenges I faced during the development of AccessiStudy, I'm still proud of the accessibility features. When I first started, I didn't know how to change the styling of a pre-existing website. Through hours of research, testing, and debugging, I was able to create a result that I was happy about. 

## What we learned
- How to create an extension: This was the first extension I have ever made, and I learned a lot about extension development through this project.
- DOM Manipulation: I learned how to change the styling of a pre-existing website.
- Chrome extension API: I learned how to use the Chrome extension API to store data, send messages, and inject scripts.


## What's next for AccessiStudy
In the future, there are many features that I would like to add, starting with the annotation tools. While I was unsuccessful in implementing them in this short amount of time, I plan on adding them in the future, as they would be a useful feature for this extension. I also plan on adding a text-to-speech function to help users with reading difficulties. 

# Instructions:
### Installing the Extension
1. Download the extension files from the green code button
2. Go to chrome://extensions/
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the folder containing the extension files

### Gemini API key
1. Go to https://aistudio.google.com/
2. Open the dashboard
3. Click the "Create API Key" button
4. Copy the provided key into the extension.



## Credits
- https://youtu.be/0n809nd4Zu4
- https://youtu.be/uMsrBz8DKCg
- https://youtu.be/mcfCdFS9VBY
- https://opendyslexic.org/

## Tech Used:
- VS Code + extensions
- ChatGPT for debugging and for cleaning up & formatting code
- Screencastify for recording & CapCut for editing.