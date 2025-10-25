class ConfigManager {
  static async load() {
    try {
      const response = await fetch(chrome.runtime.getURL('config.local.json'));
      if (!response.ok) {
        throw new Error('Config file not found');
      }
      return await response.json();
    } catch (error) {
      console.warn('Config file not found or invalid. AI features will be disabled.');
      return {};
    }
  }
}
