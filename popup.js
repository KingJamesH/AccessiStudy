document.addEventListener('DOMContentLoaded', () => {
  const highContrastToggle = document.getElementById('highContrast');
  const textSizeSlider = document.getElementById('textSize');
  const textSizeValue = document.getElementById('textSizeValue');
  const dyslexicFontToggle = document.getElementById('dyslexicFont');
  const textSpacingSlider = document.getElementById('textSpacing');
  const textSpacingValue = document.getElementById('textSpacingValue');
  const lineSpacingSlider = document.getElementById('lineSpacing');
  const lineSpacingValue = document.getElementById('lineSpacingValue');
  const overlayColorPicker = document.getElementById('overlayColor');
  const overlayOpacitySlider = document.getElementById('overlayOpacity');
  const applyBtn = document.getElementById('applyBtn');
  const resetBtn = document.getElementById('resetBtn');
  const statusEl = document.getElementById('status');
  
  textSizeSlider.addEventListener('input', () => {
    textSizeValue.textContent = `${textSizeSlider.value}%`;
  });
  
  if (textSpacingValue) {
    textSpacingSlider.addEventListener('input', () => {
      textSpacingValue.textContent = `${textSpacingSlider.value * 100}%`;
    });
  }
  
  if (lineSpacingValue) {
    lineSpacingSlider.addEventListener('input', () => {
      lineSpacingValue.textContent = `${lineSpacingSlider.value * 100}%`;
    });
  }
  
  chrome.storage.sync.get(null, (settings) => {
    highContrastToggle.checked = settings.highContrast || false;
    textSizeSlider.value = settings.textSize || 100;
    textSizeValue.textContent = `${textSizeSlider.value}%`;
    dyslexicFontToggle.checked = settings.dyslexicFont || false;
    
    const defaultTextSpacing = 1.0;
    const minTextSpacing = 1.0;  
    const maxTextSpacing = 3.0;  
    
    const currentTextSpacing = Math.min(Math.max(settings.textSpacing || defaultTextSpacing, minTextSpacing), maxTextSpacing);
    
    textSpacingSlider.min = minTextSpacing;
    textSpacingSlider.max = maxTextSpacing;
    textSpacingSlider.step = 0.1;  
    textSpacingSlider.value = currentTextSpacing;
    
    if (textSpacingValue) {
      textSpacingValue.textContent = `${Math.round(currentTextSpacing * 100)}%`;
    }
    
    // Initialize line spacing
    const defaultLineSpacing = 1.0;
    const currentLineSpacing = Math.min(Math.max(settings.lineSpacing || defaultLineSpacing, minTextSpacing), maxTextSpacing);
    
    lineSpacingSlider.min = minTextSpacing;
    lineSpacingSlider.max = maxTextSpacing;
    lineSpacingSlider.step = 0.1;
    lineSpacingSlider.value = currentLineSpacing;
    
    if (lineSpacingValue) {
      lineSpacingValue.textContent = `${Math.round(currentLineSpacing * 100)}%`;
    }
    
    overlayColorPicker.value = settings.overlayColor || '#000000';
    overlayOpacitySlider.value = settings.overlayOpacity || 0;
  });
  
  applyBtn.addEventListener('click', async () => {
    const textSpacingValue = parseFloat(textSpacingSlider.value);
    console.log('Text Spacing Value:', textSpacingValue); 
    
    const settings = {
      highContrast: highContrastToggle.checked,
      textSize: parseInt(textSizeSlider.value),
      dyslexicFont: dyslexicFontToggle.checked,
      textSpacing: parseFloat(textSpacingSlider.value),
      lineSpacing: parseFloat(lineSpacingSlider.value),
      overlayColor: overlayColorPicker.value,
      overlayOpacity: parseFloat(overlayOpacitySlider.value)
    };
    
    if (statusEl) {
      statusEl.textContent = 'Applying settings...';
      statusEl.className = 'status-message info show';
    }
    
    try {
      await chrome.storage.sync.set(settings);
      
      const success = await injectAndSendMessage(settings);
      
      if (success) {
        if (statusEl) {
          statusEl.textContent = 'Settings applied successfully!';
          statusEl.className = 'status-message success show';
        }
      } else {
        throw new Error('Failed to apply settings');
      }
    } catch (error) {
      console.error('Error applying settings:', error);
      if (statusEl) {
        statusEl.textContent = 'Error applying settings. Please try again.';
        statusEl.className = 'status-message error show';
      }
      return; 
    }
    
    setTimeout(() => window.close(), 500);
  });
  
  resetBtn.addEventListener('click', async () => {
    highContrastToggle.checked = false;
    textSizeSlider.value = 100;
    textSizeValue.textContent = '100%';
    dyslexicFontToggle.checked = false;
    
    const defaultTextSpacing = 1.0;
    textSpacingSlider.value = defaultTextSpacing;
    if (textSpacingValue) {
      textSpacingValue.textContent = '100%';
    }
    
    lineSpacingSlider.value = defaultTextSpacing;
    if (lineSpacingValue) {
      lineSpacingValue.textContent = '100%';
    }
    
    if (statusEl) {
      statusEl.textContent = 'Resetting to default settings...';
      statusEl.className = 'status-message info show';
    }
    
    try {
      await chrome.storage.sync.set(defaultSettings);
      
      const success = await injectAndSendMessage(defaultSettings);
      
      if (success) {
        if (statusEl) {
          statusEl.textContent = 'Settings reset successfully!';
          statusEl.className = 'status-message success show';
        }
      } else {
        throw new Error('Failed to reset settings');
      }
    } catch (error) {
      console.error('Error resetting settings:', error);
      if (statusEl) {
        statusEl.textContent = 'Error resetting settings. Please try again.';
        statusEl.className = 'status-message error show';
      }
      return; 
    }
    
    setTimeout(() => window.close(), 500);
  });
  
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }

  const updateSettingsInRealTime = debounce(async () => {
    const settings = {
      highContrast: highContrastToggle.checked,
      textSize: parseInt(textSizeSlider.value),
      dyslexicFont: dyslexicFontToggle.checked,
      textSpacing: parseFloat(textSpacingSlider.value),
      overlayColor: overlayColorPicker.value,
      overlayOpacity: parseFloat(overlayOpacitySlider.value)
    };
    
    try {
      await chrome.storage.sync.set(settings);
      
      await injectAndSendMessage(settings);
    } catch (error) {
      console.error('Error updating settings in real-time:', error);
    }
  }, 150); 

  [highContrastToggle, dyslexicFontToggle].forEach(element => {
    element.addEventListener('change', updateSettingsInRealTime);
  });
  
  [textSizeSlider, textSpacingSlider, overlayOpacitySlider].forEach(element => {
    element.addEventListener('input', updateSettingsInRealTime);
  });
  
  overlayColorPicker.addEventListener('change', updateSettingsInRealTime);
});
