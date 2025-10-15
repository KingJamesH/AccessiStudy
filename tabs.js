// Initialize tabs when the DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  const tabs = document.querySelectorAll('.tab-button');
  const tabPanes = document.querySelectorAll('.tab-pane');
  
  // First, hide all tab panes
  tabPanes.forEach(pane => {
    pane.style.display = 'none';
  });
  
  // Function to show a specific tab
  function showTab(tabElement) {
    // Get the target panel ID from the tab's aria-controls attribute
    const panelId = tabElement.getAttribute('aria-controls');
    if (!panelId) return;
    
    // Hide all tab panes
    tabPanes.forEach(pane => {
      pane.style.display = 'none';
      pane.classList.remove('active');
    });
    
    // Deactivate all tabs
    tabs.forEach(tab => {
      tab.classList.remove('active');
      tab.setAttribute('aria-selected', 'false');
      tab.setAttribute('tabindex', '-1');
    });
    
    // Activate the selected tab
    tabElement.classList.add('active');
    tabElement.setAttribute('aria-selected', 'true');
    tabElement.removeAttribute('tabindex');
    
    // Show the corresponding panel
    const panel = document.getElementById(panelId);
    if (panel) {
      panel.style.display = 'block';
      panel.classList.add('active');
    }
  }
  
  // Initialize the active tab on load
  const activeTab = document.querySelector('.tab-button[aria-selected="true"]');
  if (activeTab) {
    showTab(activeTab);
  } else if (tabs.length > 0) {
    // If no tab is active, activate the first one
    tabs[0].setAttribute('aria-selected', 'true');
    showTab(tabs[0]);
  }
  
  // Add click and keyboard event handlers for tabs
  tabs.forEach(tab => {
    // Click handler
    tab.addEventListener('click', function() {
      showTab(this);
    });
    
    // Keyboard navigation
    tab.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showTab(this);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const currentIndex = Array.from(tabs).indexOf(this);
        const direction = e.key === 'ArrowRight' ? 1 : -1;
        const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
        
        tabs[nextIndex].focus();
        showTab(tabs[nextIndex]);
      }
    });
  });
});
