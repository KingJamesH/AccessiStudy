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
    
    // Apply annotation to selected text
    function applyAnnotation(type, color = null) {
      const selection = window.getSelection();
      if (selection.rangeCount === 0 || selection.isCollapsed) return false;
      
      try {
        const range = selection.getRangeAt(0);
        const selectedText = selection.toString().trim();
        if (!selectedText) return false;
        
        // Create a span to wrap the selection
        const span = document.createElement('span');
        span.className = `annotation-${type}`;
        
        // Apply specific styling based on annotation type
        switch (type) {
          case 'highlight':
            span.style.backgroundColor = color || 'rgba(255, 255, 0, 0.3)';
            span.style.padding = '0 2px';
            span.style.borderRadius = '2px';
            break;
            
          case 'underline':
            span.style.textDecoration = 'underline';
            span.style.textDecorationThickness = '2px';
            span.style.textUnderlineOffset = '2px';
            if (color) span.style.textDecorationColor = color;
            break;
            
          case 'bold':
            span.style.fontWeight = 'bold';
            break;
            
          case 'note':
            const noteId = 'note-' + Date.now();
            span.dataset.noteId = noteId;
            span.style.borderBottom = `2px dotted ${color || '#2196F3'}`;
            span.style.position = 'relative';
            span.style.cursor = 'help';
            break;
        }
        
        // Save the selection
        range.surroundContents(span);
        selection.removeAllRanges();
        
        return true;
      } catch (error) {
        console.error('Error applying annotation:', error);
        return false;
      }
    }
    
    // Add a note with tooltip
    function addNote(annotation) {
      const selection = window.getSelection();
      if (selection.rangeCount === 0 || selection.isCollapsed) return false;
      
      const range = selection.getRangeAt(0);
      const selectedText = selection.toString().trim();
      if (!selectedText) return false;
      
      try {
        const span = document.createElement('span');
        span.className = 'annotation-note';
        span.dataset.noteId = annotation.id;
        span.style.borderBottom = `2px dotted ${annotation.color || '#2196F3'}`;
        span.style.position = 'relative';
        span.style.cursor = 'help';
        
        // Create tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'annotation-tooltip';
        tooltip.textContent = annotation.content;
        tooltip.style.display = 'none';
        tooltip.style.position = 'absolute';
        tooltip.style.background = 'white';
        tooltip.style.border = '1px solid #ddd';
        tooltip.style.padding = '8px 12px';
        tooltip.style.borderRadius = '4px';
        tooltip.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
        tooltip.style.zIndex = '10000';
        tooltip.style.minWidth = '200px';
        tooltip.style.maxWidth = '300px';
        tooltip.style.bottom = '100%';
        tooltip.style.left = '0';
        tooltip.style.marginBottom = '5px';
        tooltip.style.wordBreak = 'break-word';
        tooltip.style.whiteSpace = 'normal';
        
        span.appendChild(tooltip);
        
        // Show/hide tooltip on hover
        span.addEventListener('mouseenter', (e) => {
          tooltip.style.display = 'block';
          positionTooltip(tooltip, span);
        });
        
        span.addEventListener('mouseleave', () => {
          tooltip.style.display = 'none';
        });
        
        // Handle clicks on the note
        span.addEventListener('click', (e) => {
          e.stopPropagation();
          tooltip.style.display = tooltip.style.display === 'none' ? 'block' : 'none';
          if (tooltip.style.display === 'block') {
            positionTooltip(tooltip, span);
          }
        });
        
        // Save the selection
        range.surroundContents(span);
        selection.removeAllRanges();
        
        return true;
      } catch (error) {
        console.error('Error adding note:', error);
        return false;
      }
    }
    
    // Position tooltip to ensure it stays within viewport
    function positionTooltip(tooltip, element) {
      const rect = element.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      
      let left = rect.left;
      let top = rect.top - tooltipRect.height - 5;
      
      // Adjust if tooltip goes off the left/right of the viewport
      if (left < 10) {
        left = 10;
      } else if (left + tooltipRect.width > window.innerWidth - 10) {
        left = window.innerWidth - tooltipRect.width - 10;
      }
      
      // If tooltip would go above the viewport, show it below
      if (top < 10) {
        top = rect.bottom + 5;
      }
      
      tooltip.style.left = `${left - rect.left}px`;
      tooltip.style.top = `${top - rect.top}px`;
    }
    
    // Remove annotation by ID
    function removeAnnotation(id) {
      const elements = document.querySelectorAll(`[data-note-id="${id}"]`);
      elements.forEach(el => {
        const parent = el.parentNode;
        if (parent) {
          // Replace the element with its contents
          while (el.firstChild) {
            parent.insertBefore(el.firstChild, el);
          }
          parent.removeChild(el);
          parent.normalize(); // Clean up any empty text nodes
        }
      });
    }
    
    // Clear formatting from selection
    function clearFormatting() {
      const selection = window.getSelection();
      if (selection.rangeCount === 0 || selection.isCollapsed) return false;
      
      const range = selection.getRangeAt(0);
      const selectedText = selection.toString().trim();
      if (!selectedText) return false;
      
      try {
        // Create a new range that includes the full elements
        const ancestor = range.commonAncestorContainer;
        const startNode = range.startContainer;
        const endNode = range.endContainer;
        
        // Get all elements in the selection
        const allElements = new Set();
        let node = startNode;
        
        while (node && node !== endNode) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            allElements.add(node);
          }
          node = getNextNode(node);
        }
        
        // Process each element to remove annotation classes
        allElements.forEach(el => {
          if (el.classList) {
            el.classList.remove('annotation-highlight', 'annotation-underline', 'annotation-bold', 'annotation-note');
            
            // Remove inline styles that might have been added
            el.style.removeProperty('background-color');
            el.style.removeProperty('text-decoration');
            el.style.removeProperty('font-weight');
            el.style.removeProperty('border-bottom');
            
            // If the element is empty after removing annotations, remove it
            if (!el.textContent.trim() && el.parentNode) {
              el.parentNode.removeChild(el);
            }
          }
        });
        
        // Clean up any empty parent elements
        if (ancestor.nodeType === Node.ELEMENT_NODE) {
          ancestor.normalize();
        }
        
        selection.removeAllRanges();
        return true;
      } catch (error) {
        console.error('Error clearing formatting:', error);
        return false;
      }
    }
    
    // Helper function to get the next node in the DOM tree
    function getNextNode(node) {
      if (node.firstChild) return node.firstChild;
      while (node) {
        if (node.nextSibling) return node.nextSibling;
        node = node.parentNode;
      }
      return null;
    }

    // Handle messages from the popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      try {
        switch (request.action) {
          case 'applyAccessibility':
            if (request.settings) {
              // Apply only when messaged by the popup. Do not persist here.
              applySettingsWithRetry(request.settings);
              sendResponse({status: 'success'});
            }
            break;
            
          case 'applyAnnotation':
            if (request.type) {
              const success = applyAnnotation(request.type, request.color);
              sendResponse({status: success ? 'success' : 'error'});
            }
            break;
            
          case 'addNote':
            if (request.annotation) {
              const success = addNote(request.annotation);
              sendResponse({status: success ? 'success' : 'error'});
            }
            break;
            
          case 'removeAnnotation':
            if (request.id) {
              removeAnnotation(request.id);
              sendResponse({status: 'success'});
            }
            break;
            
          case 'clearFormatting':
            const success = clearFormatting();
            sendResponse({status: success ? 'success' : 'error'});
            break;
        }
      } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({status: 'error', message: error.message});
      }
      
      return true; // Keep the message channel open for async response
    });
    
    // Load saved annotations when the page loads
    // Keep annotations load minimal; no auto-applying of styles.
    document.addEventListener('DOMContentLoaded', () => {
      chrome.storage.sync.get('annotations', () => {});
    });
    
    // Intentionally do not auto-apply on DOMContentLoaded.
  
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
          
          .accessibility-dyslexic {
            font-family: 'OpenDyslexic', sans-serif !important;
            /* Allow spacing to be controlled by other styles */
            letter-spacing: inherit !important;
            word-spacing: inherit !important;
            line-height: inherit !important;
          }
          
          /* Apply font to all child elements */
          .accessibility-dyslexic * {
            font-family: inherit !important;
            letter-spacing: inherit !important;
            word-spacing: inherit !important;
            line-height: inherit !important;
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
        /* Apply spacing to common body text elements; avoid forcing headings */
        p, div, span, a, li, td, th, label,
        figcaption, blockquote, cite,
        article, section, header, footer, nav, aside, main, figure, 
        time, mark, small, strong, em, i, b, u, sub, sup, code, pre, 
        kbd, samp, var, dfn, abbr, q, address, dt, dd, 
        ol, ul, dl, table, caption, thead, tbody, tfoot, tr, fieldset, legend,
        details, summary, menu, menuitem, [role="paragraph"], [role="listitem"],
        [role="term"], [role="definition"], [role="text"] {
          letter-spacing: ${letterSpacing}em !important;
          word-spacing: ${wordSpacing}em !important;
          line-height: ${lineHeight} !important;
        }
        
        /* Preserve relative prominence of headings by not overriding their line-height */
        /* You can optionally add milder spacing for headings if desired */
        /* h1, h2, h3, h4, h5, h6 { line-height: ${Math.max(1.1, Math.min(1.6, lineHeight))} !important; } */
        
        input, textarea, select, button {
          padding: 0.5em !important;
        }
        
        ::placeholder, input::placeholder, textarea::placeholder {
          letter-spacing: ${letterSpacing}em !important;
          word-spacing: ${wordSpacing}em !important;
        }
        
        /* Enhance text rendering for common text elements (excluding headings) */
        p, div, span, a, li, td, th, label,
        figcaption, blockquote, cite,
        article, section, header, footer, nav, aside, main, figure, 
        time, mark, small, strong, em, i, b, u, sub, sup, code, pre, 
        kbd, samp, var, dfn, abbr, q, address, dt, dd, 
        ol, ul, dl, table, caption, thead, tbody, tfoot, tr, fieldset, legend,
        details, summary, menu, menuitem, [role="paragraph"], [role="listitem"],
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
  
  // Do not auto-apply settings from storage on script load.