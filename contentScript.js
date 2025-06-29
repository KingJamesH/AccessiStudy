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

    function loadAndApplySettings() {
      chrome.storage.sync.get(null, (settings) => {
        if (Object.keys(settings).length > 0) {
          console.log('Loading saved settings:', settings);
          applySettingsWithRetry(settings);
        }
      });
    }
    
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'applyAccessibility' && request.settings) {
        try {
          applySettingsWithRetry(request.settings);
          chrome.storage.sync.set(request.settings);
          sendResponse({status: 'success'});
        } catch (error) {
          console.error('Error applying accessibility settings:', error);
          sendResponse({status: 'error', message: error.message});
        }
      }
      return true; 
    });
    
    document.addEventListener('DOMContentLoaded', loadAndApplySettings);
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadAndApplySettings);
    } else {
      loadAndApplySettings();
    }
  
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
          html.accessibility-high-contrast,
          html.accessibility-high-contrast * {
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
          html.accessibility-high-contrast *::before,
          html.accessibility-high-contrast *::after,
          html.accessibility-high-contrast *::first-letter,
          html.accessibility-high-contrast *::first-line {
            background-color: #000 !important;
            color: #fff !important;
            border-color: #fff !important;
          }
          
          /* Links */
          html.accessibility-high-contrast a,
          html.accessibility-high-contrast a:link,
          html.accessibility-high-contrast a:visited,
          html.accessibility-high-contrast a:hover,
          html.accessibility-high-contrast a:active,
          html.accessibility-high-contrast a:focus {
            color: #1e90ff !important;
            text-decoration: underline !important;
            background: transparent !important;
          }
          
          /* Form elements - only modify colors, preserve layout */
          html.accessibility-high-contrast input,
          html.accessibility-high-contrast textarea,
          html.accessibility-high-contrast select,
          html.accessibility-high-contrast button {
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
          html.accessibility-high-contrast button,
          html.accessibility-high-contrast [role="button"],
          html.accessibility-high-contrast [type="button"],
          html.accessibility-high-contrast [type="submit"],
          html.accessibility-high-contrast [type="reset"] {
            border-width: 1px !important;
            border-style: solid !important;
            /* Keep original padding */
            padding: inherit !important;
          }
          
          /* Tables - only modify colors, preserve layout */
          html.accessibility-high-contrast table,
          html.accessibility-high-contrast th,
          html.accessibility-high-contrast td {
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
          html.accessibility-high-contrast img,
          html.accessibility-high-contrast svg,
          html.accessibility-high-contrast video,
          html.accessibility-high-contrast canvas,
          html.accessibility-high-contrast iframe,
          html.accessibility-high-contrast object,
          html.accessibility-high-contrast embed {
            /* Use opacity instead of filter to prevent layout shifts */
            opacity: 1 !important;
            /* Add outline for better visibility */
            outline: 1px solid #fff !important;
            outline-offset: -1px !important;
          }
          
          /* Override any existing high contrast mode */
          html.accessibility-high-contrast [style*="contrast"],
          html.accessibility-high-contrast [style*="invert"],
          html.accessibility-high-contrast [style*="grayscale"] {
            filter: none !important;
          }
          
          /* Ensure text is visible in form controls */
          html.accessibility-high-contrast ::placeholder,
          html.accessibility-high-contrast ::-webkit-input-placeholder,
          html.accessibility-high-contrast ::-moz-placeholder,
          html.accessibility-high-contrast :-ms-input-placeholder,
          html.accessibility-high-contrast :-moz-placeholder {
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
      
      const sizeMultiplier = settings.textSize / 100;
      styleElement.textContent = `
        body {
          font-size: ${sizeMultiplier}em !important;
        }
        body * {
          font-size: inherit !important;
        }
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
          
          .accessibility-dyslexic, 
          .accessibility-dyslexic * {
            font-family: 'OpenDyslexic', sans-serif !important;
            letter-spacing: 0.05em !important;
            word-spacing: 0.1em !important;
            line-height: 1.6 !important;
          }
          
          .accessibility-dyslexic b,
          .accessibility-dyslexic strong {
            font-weight: bold !important;
          }
          
          .accessibility-dyslexic i,
          .accessibility-dyslexic em {
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
      const lineHeight = 1 + ((lineScale - 1) * 0.5); 
      
      console.log('Calculated values - textScale:', textScale, 'lineScale:', lineScale, 
                 'letter:', letterSpacing, 'word:', wordSpacing, 'line:', lineHeight);
      
      const css = `
        /* Base line height for the document */
        html, body {
          line-height: ${lineHeight} !important;
        }
        
        /* Apply to all text elements */
        body * {
          letter-spacing: ${letterSpacing}em !important;
          word-spacing: ${wordSpacing}em !important;
          line-height: ${lineHeight} !important;
        }
        
        /* More specific targeting for common text containers */
        p, h1, h2, h3, h4, h5, h6, div, span, a, li, td, th, label,
        input, textarea, select, button, figcaption, blockquote, cite,
        article, section, header, footer, nav, aside, main, figure, 
        time, mark, small, strong, em, i, b, u, sub, sup, code, pre, 
        kbd, samp, var, dfn, abbr, q, blockquote, address, dt, dd, 
        ol, ul, dl, table, caption, thead, tbody, tfoot, tr, td, th,
        fieldset, legend, details, summary, menu, menuitem, 
        [role="heading"], [role="paragraph"], [role="listitem"],
        [role="term"], [role="definition"], [role="text"] {
          letter-spacing: ${letterSpacing}em !important;
          word-spacing: ${wordSpacing}em !important;
          line-height: ${lineHeight} !important;
        }
        
        input, textarea, select, button {
          padding: 0.5em !important;
        }
        
        ::placeholder, input::placeholder, textarea::placeholder {
          letter-spacing: ${letterSpacing}em !important;
          word-spacing: ${wordSpacing}em !important;
        }
        
        /* Force text rendering for better compatibility - target text elements specifically */
        p, h1, h2, h3, h4, h5, h6, div, span, a, li, td, th, label,
        input, textarea, select, button, figcaption, blockquote, cite,
        article, section, header, footer, nav, aside, main, figure, 
        time, mark, small, strong, em, i, b, u, sub, sup, code, pre, 
        kbd, samp, var, dfn, abbr, q, blockquote, address, dt, dd, 
        ol, ul, dl, table, caption, thead, tbody, tfoot, tr, td, th,
        fieldset, legend, details, summary, menu, menuitem, 
        [role="heading"], [role="paragraph"], [role="listitem"],
        [role="term"], [role="definition"], [role="text"] {
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
  
  chrome.storage.sync.get(null, (settings) => {
    if (Object.keys(settings).length > 0) {
      applyAccessibilitySettings(settings);
    }
  });