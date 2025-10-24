## Inspiration
Around [20% of students](https://ncld.org/wp-content/uploads/2023/07/NCLD_2016%E2%80%932017-Annual-Report-1.pdf) in the US have a learning disability. Only around [10% of web pages](https://webaim.org/projects/million/) meet basic accessibility standards. I created AccessiStudy to help students better access the web. While there are some apps and extensions that can help with accessibility, almost all of them only address one aspect, and most of them are complex and somewhat hard to use. AccessiStudy is a simple and easy to use extension that addresses multiple aspects of accessibility in one spot, helping students better access the web.

## What it does
AccessiStudy is an extension meant to **improve the accessibility** of webpages. It provides a clean, intuitive interface where users can easily apply accessibility features to the current webpage. The extension offers text size adjustment, word spacing, line spacing controls, and toggle options for dyslexic-friendly font and high contrast mode. All features are immediately accessible without navigation between tabs. 

## How we built it

AccessiStudy is built using **HTML, CSS, and JavaScript**. The extension is built using the **Chrome extension API**. All of the accessibility features are injected by manipulating the **Document Object Model (DOM)**. The interface uses collapsible sections for clean organization and stores user preferences using Chrome's storage API.

## Challenges we ran into

AccessiStudy was the **first** extension I built. As a result, I had to learn a lot of new things, including the Chrome Extension API, DOM manipulation, and cross-origin communication. 

## Accomplishments that we're proud of

Despite the challenges I faced during the development of AccessiStudy, I'm still proud of the accessibility features. When I first started, I didn't know how to change the styling of a pre-existing website. Through hours of research, testing, and debugging, I was able to create a result that I was happy about. 

## What we learned
- How to create an extension: This was the first extension I have ever made, and I learned a lot about extension development through this project.
- DOM Manipulation: I learned how to change the styling of a pre-existing website.
- Chrome extension API: I learned how to use the Chrome extension API to store data, send messages, and inject scripts.
- UI/UX Design: I learned the importance of clean, intuitive interfaces and how simplifying navigation can improve user experience.
- CSS Architecture: I gained experience managing CSS specificity and creating maintainable styling systems.

## What's next for AccessiStudy
In the future, there are many features that I would like to add, starting with the annotation tools. While I was unsuccessful in implementing them in this short amount of time, I plan on adding them in the future, as they would be a useful feature for this extension. I also plan on adding a text-to-speech function to help users with reading difficulties. 

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