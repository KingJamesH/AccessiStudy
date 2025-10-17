if (window === window.top && !window.location.href.startsWith('chrome-extension://')) {
    function applySettingsWithRetry(settings, retries = 3, delay = 100) {
      try {
        applyAccessibilitySettings(settings);
      } catch (error) {
        if (retries > 0) {
          console.log(`Retrying to apply settings (${retries} attempts left)...`);
          setTimeout(() => applySettingsWithRetry(settings, retries - 1, delay * 2), delay);
        } else {
          console.error('Failed to apply settings after multiple attempts:', error);
        }
      }
    }

    // Removed auto-load of settings from storage to ensure the extension
    // does NOT auto-apply on every page. Settings are now applied only
    // when the user clicks Apply in the popup (via message).

    // Handle messages from the popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('Content script received message:', request.action, request);
      
      // Handle ping/pong for connection testing
      if (request.action === 'ping') {
        console.log('Ping received, sending pong');
        sendResponse({ status: 'pong' });
        return true;
      }
      
      try {
        switch (request.action) {
          case 'ping':
            sendResponse({ status: 'pong' });
            break;
          case 'applyAccessibility':
            if (request.settings) {
              // Debug log to verify delivery
              try { console.log('[ContentScript] Applying settings', request.settings); } catch (e) {}
              // Apply only when messaged by the popup. Do not persist here.
              applySettingsWithRetry(request.settings);
              sendResponse({status: 'success'});
            }
            break;
        }
      } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({status: 'error', message: error.message});
      }
      
      return true; // Keep the message channel open for async response
    });
    
    // Notify that content script is ready
    chrome.runtime.sendMessage({action: 'contentScriptReady'});
  }
  
  function applyAccessibilitySettings(settings) {
    document.documentElement.classList.remove(
      'accessibility-high-contrast',
      'accessibility-large-text',
      'accessibility-dyslexic'
    );
    
    document.body.classList.remove(
      'accessibility-high-contrast',
      'accessibility-large-text',
      'accessibility-dyslexic'
    );
  
    if (settings.highContrast) {
      document.documentElement.classList.add('accessibility-high-contrast');
      document.body.classList.add('accessibility-high-contrast');
      
      const styleId = 'accessibility-high-contrast-style';
      let styleElement = document.getElementById(styleId);
      
      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = `
          /* Apply high contrast colors without affecting layout */
          html.accessibility-high-contrast:not(.chrome-extension-popup),
          html.accessibility-high-contrast *:not(.chrome-extension-popup) {
            /* Only modify color-related properties */
            background-color: #000 !important;
            color: #fff !important;
            border-color: #fff !important;
            outline-color: #fff !important;
            text-shadow: none !important;
            box-shadow: none !important;
            fill: #fff !important;
            stroke: #fff !important;
            scrollbar-color: #fff #000 !important;
            /* Preserve existing layout properties */
            background-image: none !important;
            background: #000 !important;
          }
          
          /* For pseudo-elements */
          html.accessibility-high-contrast *:not(.chrome-extension-popup)::before,
          html.accessibility-high-contrast *:not(.chrome-extension-popup)::after,
          html.accessibility-high-contrast *:not(.chrome-extension-popup)::first-letter,
          html.accessibility-high-contrast *:not(.chrome-extension-popup)::first-line {
            background-color: #000 !important;
            color: #fff !important;
            border-color: #fff !important;
          }
          
          /* Links */
          html.accessibility-high-contrast a:not(.chrome-extension-popup),
          html.accessibility-high-contrast a:link:not(.chrome-extension-popup),
          html.accessibility-high-contrast a:visited:not(.chrome-extension-popup),
          html.accessibility-high-contrast a:hover:not(.chrome-extension-popup),
          html.accessibility-high-contrast a:active:not(.chrome-extension-popup),
          html.accessibility-high-contrast a:focus:not(.chrome-extension-popup) {
            color: #1e90ff !important;
            text-decoration: underline !important;
            background: transparent !important;
          }
          
          /* Form elements - only modify colors, preserve layout */
          html.accessibility-high-contrast input:not(.chrome-extension-popup),
          html.accessibility-high-contrast textarea:not(.chrome-extension-popup),
          html.accessibility-high-contrast select:not(.chrome-extension-popup),
          html.accessibility-high-contrast button:not(.chrome-extension-popup) {
            background-color: #000 !important;
            color: #fff !important;
            border-color: #fff !important;
            /* Preserve original padding and dimensions */
            padding: inherit !important;
            width: auto !important;
            height: auto !important;
            min-width: 0 !important;
            min-height: 0 !important;
            max-width: none !important;
            max-height: none !important;
          }
          
          /* Buttons - only modify colors, preserve layout */
          html.accessibility-high-contrast button:not(.chrome-extension-popup),
          html.accessibility-high-contrast [role="button"]:not(.chrome-extension-popup),
          html.accessibility-high-contrast [type="button"]:not(.chrome-extension-popup),
          html.accessibility-high-contrast [type="submit"]:not(.chrome-extension-popup),
          html.accessibility-high-contrast [type="reset"]:not(.chrome-extension-popup) {
            border-width: 1px !important;
            border-style: solid !important;
            /* Keep original padding */
            padding: inherit !important;
          }
          
          /* Tables - only modify colors, preserve layout */
          html.accessibility-high-contrast table:not(.chrome-extension-popup),
          html.accessibility-high-contrast th:not(.chrome-extension-popup),
          html.accessibility-high-contrast td:not(.chrome-extension-popup) {
            border-color: #fff !important;
            border-style: solid !important;
            border-width: 1px !important;
            background-color: #000 !important;
            background-image: none !important;
            /* Preserve table layout */
            border-collapse: separate !important;
            border-spacing: 0 !important;
          }
          
          /* Images and media - only modify appearance, not layout */
          html.accessibility-high-contrast img:not(.chrome-extension-popup),
          html.accessibility-high-contrast svg:not(.chrome-extension-popup),
          html.accessibility-high-contrast video:not(.chrome-extension-popup),
          html.accessibility-high-contrast canvas:not(.chrome-extension-popup),
          html.accessibility-high-contrast iframe:not(.chrome-extension-popup),
          html.accessibility-high-contrast object:not(.chrome-extension-popup),
          html.accessibility-high-contrast embed:not(.chrome-extension-popup) {
            /* Use opacity instead of filter to prevent layout shifts */
            opacity: 1 !important;
            /* Add outline for better visibility */
            outline: 1px solid #fff !important;
            outline-offset: -1px !important;
          }
          
          /* Override any existing high contrast mode */
          html.accessibility-high-contrast [style*="contrast"]:not(.chrome-extension-popup),
          html.accessibility-high-contrast [style*="invert"]:not(.chrome-extension-popup),
          html.accessibility-high-contrast [style*="grayscale"]:not(.chrome-extension-popup) {
            filter: none !important;
          }
          
          /* Ensure text is visible in form controls */
          html.accessibility-high-contrast ::placeholder:not(.chrome-extension-popup),
          html.accessibility-high-contrast ::-webkit-input-placeholder:not(.chrome-extension-popup),
          html.accessibility-high-contrast ::-moz-placeholder:not(.chrome-extension-popup),
          html.accessibility-high-contrast :-ms-input-placeholder:not(.chrome-extension-popup),
          html.accessibility-high-contrast :-moz-placeholder:not(.chrome-extension-popup) {
            color: #ccc !important;
            opacity: 1 !important;
          }
        `;
        document.head.appendChild(styleElement);
      }
    } else {
      document.documentElement.classList.remove('accessibility-high-contrast');
      document.body.classList.remove('accessibility-high-contrast');
      
      const styleElement = document.getElementById('accessibility-high-contrast-style');
      if (styleElement) {
        styleElement.remove();
      }
    }
  
    if (settings.textSize && settings.textSize !== 100) {
      const styleId = 'accessibility-text-size';
      let styleElement = document.getElementById(styleId);
      
      if (!styleElement) {
        styleElement = document.createElement('style'); 
        styleElement.id = styleId;
        document.head.appendChild(styleElement);
      }
      
      // Use page zoom to preserve all relative font-size hierarchies and px-based sizes
      // while scaling the overall page in Chrome.
      const scale = Math.max(0.5, Math.min(2.5, parseInt(settings.textSize, 10) / 100));
      styleElement.textContent = `
        html { zoom: ${scale} !important; }
      `;
    } else {
      const styleElement = document.getElementById('accessibility-text-size');
      if (styleElement) {
        styleElement.remove();
      }
    }
  
    let dyslexicStyle = document.getElementById('accessibility-dyslexic-font');
     
    if (settings.dyslexicFont) {
      if (!dyslexicStyle) {
        dyslexicStyle = document.createElement('style');
        dyslexicStyle.id = 'accessibility-dyslexic-font';
        dyslexicStyle.textContent = `
          @font-face {
            font-family: 'OpenDyslexic';
            src: url('${chrome.runtime.getURL('fonts/OpenDyslexic-Regular.otf')}') format('opentype');
            font-weight: normal;
            font-style: normal;
          }
          @font-face {
            font-family: 'OpenDyslexic';
            src: url('${chrome.runtime.getURL('fonts/OpenDyslexic-Bold.otf')}') format('opentype');
            font-weight: bold;
            font-style: normal;
          }
          @font-face {
            font-family: 'OpenDyslexic';
            src: url('${chrome.runtime.getURL('fonts/OpenDyslexic-Italic.otf')}') format('opentype');
            font-weight: normal;
            font-style: italic;
          }
          @font-face {
            font-family: 'OpenDyslexic';
            src: url('${chrome.runtime.getURL('fonts/OpenDyslexic-BoldItalic.otf')}') format('opentype');
            font-weight: bold;
            font-style: italic;
          }
          
          .accessibility-dyslexic:not(.chrome-extension-popup) {
            font-family: 'OpenDyslexic', sans-serif !important;
          }
          
          /* Apply font to all child elements */
          .accessibility-dyslexic *:not(.chrome-extension-popup) {
            font-family: inherit !important;
          }
          
          .accessibility-dyslexic b:not(.chrome-extension-popup),
          .accessibility-dyslexic strong:not(.chrome-extension-popup) {
            font-weight: bold !important;
          }
          
          .accessibility-dyslexic i:not(.chrome-extension-popup),
          .accessibility-dyslexic em:not(.chrome-extension-popup) {
            font-style: italic !important;
          }
        `;
        document.head.appendChild(dyslexicStyle);
      }
      
      document.documentElement.classList.add('accessibility-dyslexic');
      document.body.classList.add('accessibility-dyslexic');
    } else if (dyslexicStyle) {
      dyslexicStyle.remove();
      document.documentElement.classList.remove('accessibility-dyslexic');
      document.body.classList.remove('accessibility-dyslexic');
    }
  
    const styleId = 'accessibility-text-spacing';
    let styleElement = document.getElementById(styleId);
    
    console.log('Current textSpacing setting:', settings.textSpacing); 
    
    if (styleElement) {
      console.log('Removing existing text spacing style'); 
      styleElement.remove();
    }
    
    if ((settings.textSpacing && settings.textSpacing !== 1) || (settings.lineSpacing && settings.lineSpacing !== 1)) {
      console.log('Creating new text spacing style with values - textSpacing:', settings.textSpacing, 'lineSpacing:', settings.lineSpacing);
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      
      const textScale = settings.textSpacing ? parseFloat(settings.textSpacing) : 1;
      const lineScale = settings.lineSpacing ? parseFloat(settings.lineSpacing) : 1;
      
      const letterSpacing = (textScale - 1) * 0.05;  
      const wordSpacing = (textScale - 1) * 0.1;    
      const lineHeight = lineScale; // Use the line scale directly for more noticeable changes
      
      console.log('Calculated values - textScale:', textScale, 'lineScale:', lineScale, 
                 'letter:', letterSpacing, 'word:', wordSpacing, 'line:', lineHeight);
      
      const css = `
        /* Apply base line height to html and body first */
        html:not(.chrome-extension-popup), body:not(.chrome-extension-popup) {
          line-height: ${lineHeight} !important;
        }

        /* Apply spacing to all text elements */
        *:not(.chrome-extension-popup) {
          line-height: inherit !important;
        }

        /* Reset specific elements that might interfere */
        br, hr, img, iframe, canvas, svg, path, rect, g, use, symbol,
        circle, ellipse, line, polygon, polyline, text, script, style,
        link, meta, title, head, html, body, input, textarea, select, button {
          line-height: normal !important;
        }

        /* Apply text spacing to all text containers - including elements with accessibility classes */
        p:not(.chrome-extension-popup), div:not(.chrome-extension-popup), span:not(.chrome-extension-popup), a:not(.chrome-extension-popup), li:not(.chrome-extension-popup), td:not(.chrome-extension-popup), th:not(.chrome-extension-popup), label:not(.chrome-extension-popup), h1:not(.chrome-extension-popup), h2:not(.chrome-extension-popup), h3:not(.chrome-extension-popup), h4:not(.chrome-extension-popup), h5:not(.chrome-extension-popup), h6:not(.chrome-extension-popup),
        figcaption:not(.chrome-extension-popup), blockquote:not(.chrome-extension-popup), cite:not(.chrome-extension-popup), article:not(.chrome-extension-popup), section:not(.chrome-extension-popup), header:not(.chrome-extension-popup),
        footer:not(.chrome-extension-popup), nav:not(.chrome-extension-popup), aside:not(.chrome-extension-popup), main:not(.chrome-extension-popup), figure:not(.chrome-extension-popup), time:not(.chrome-extension-popup), mark:not(.chrome-extension-popup), small:not(.chrome-extension-popup),
        strong:not(.chrome-extension-popup), em:not(.chrome-extension-popup), i:not(.chrome-extension-popup), b:not(.chrome-extension-popup), u:not(.chrome-extension-popup), sub:not(.chrome-extension-popup), sup:not(.chrome-extension-popup), code:not(.chrome-extension-popup), pre:not(.chrome-extension-popup), kbd:not(.chrome-extension-popup), samp:not(.chrome-extension-popup), var:not(.chrome-extension-popup),
        dfn:not(.chrome-extension-popup), abbr:not(.chrome-extension-popup), q:not(.chrome-extension-popup), address:not(.chrome-extension-popup), dt:not(.chrome-extension-popup), dd:not(.chrome-extension-popup), ol:not(.chrome-extension-popup), ul:not(.chrome-extension-popup), dl:not(.chrome-extension-popup), table:not(.chrome-extension-popup), caption:not(.chrome-extension-popup),
        thead:not(.chrome-extension-popup), tbody:not(.chrome-extension-popup), tfoot:not(.chrome-extension-popup), tr:not(.chrome-extension-popup), fieldset:not(.chrome-extension-popup), legend:not(.chrome-extension-popup), details:not(.chrome-extension-popup), summary:not(.chrome-extension-popup),
        menu:not(.chrome-extension-popup), menuitem:not(.chrome-extension-popup), [role="paragraph"]:not(.chrome-extension-popup), [role="listitem"]:not(.chrome-extension-popup),
        [role="term"]:not(.chrome-extension-popup), [role="definition"]:not(.chrome-extension-popup), [role="text"]:not(.chrome-extension-popup),
        /* Also apply to elements with accessibility classes */
        .accessibility-dyslexic:not(.chrome-extension-popup), .accessibility-high-contrast:not(.chrome-extension-popup),
        .accessibility-dyslexic *:not(.chrome-extension-popup), .accessibility-high-contrast *:not(.chrome-extension-popup) {
          line-height: ${lineHeight} !important;
          letter-spacing: ${letterSpacing}em !important;
          word-spacing: ${wordSpacing}em !important;
        }

        /* Ensure form elements are usable */
        input:not(.chrome-extension-popup), textarea:not(.chrome-extension-popup), select:not(.chrome-extension-popup), button:not(.chrome-extension-popup) {
          padding: 0.5em !important;
          line-height: normal !important;
        }

        /* Handle placeholder text */
        ::placeholder:not(.chrome-extension-popup), input::placeholder:not(.chrome-extension-popup), textarea::placeholder:not(.chrome-extension-popup) {
          letter-spacing: ${letterSpacing}em !important;
          word-spacing: ${wordSpacing}em !important;
        }
        kbd:not(.chrome-extension-popup), samp:not(.chrome-extension-popup), var:not(.chrome-extension-popup), dfn:not(.chrome-extension-popup), abbr:not(.chrome-extension-popup), q:not(.chrome-extension-popup), address:not(.chrome-extension-popup), dt:not(.chrome-extension-popup), dd:not(.chrome-extension-popup),
        ol:not(.chrome-extension-popup), ul:not(.chrome-extension-popup), dl:not(.chrome-extension-popup), table:not(.chrome-extension-popup), caption:not(.chrome-extension-popup), thead:not(.chrome-extension-popup), tbody:not(.chrome-extension-popup), tfoot:not(.chrome-extension-popup), tr:not(.chrome-extension-popup), fieldset:not(.chrome-extension-popup), legend:not(.chrome-extension-popup),
        details:not(.chrome-extension-popup), summary:not(.chrome-extension-popup), menu:not(.chrome-extension-popup), menuitem:not(.chrome-extension-popup), [role="paragraph"]:not(.chrome-extension-popup), [role="listitem"]:not(.chrome-extension-popup),
        [role="term"]:not(.chrome-extension-popup), [role="definition"]:not(.chrome-extension-popup), [role="text"]:not(.chrome-extension-popup) {
          text-rendering: optimizeLegibility !important;
          -webkit-font-smoothing: antialiased !important;
          -moz-osx-font-smoothing: grayscale !important;
        }`;
        
      styleElement.textContent = css;
      document.head.appendChild(styleElement);
      console.log('Text spacing style applied:', css);
    } else if (styleElement) {
      styleElement.remove();
    }
  
    if (settings.overlayColor && settings.overlayOpacity > 0) {
      let overlay = document.getElementById('accessibility-overlay');
      
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'accessibility-overlay';
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 2147483647;
          mix-blend-mode: overlay;
        `;
        document.documentElement.appendChild(overlay);
      }
      
      overlay.style.backgroundColor = settings.overlayColor;
      overlay.style.opacity = settings.overlayOpacity;
    } else {
      const overlay = document.getElementById('accessibility-overlay');
      if (overlay) {
        overlay.remove();
      }
    }
  }
  
  // Do not auto-apply settings from storage on script load.