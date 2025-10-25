/**
 * GitHub API integration for messages.json
 * Handles reading and writing message data to GitHub repository
 */

// GitHub configuration
const GITHUB_CONFIG = {
  owner: 'preetoshii', // GitHub username
  repo: 'bounsight',
  branch: 'master',
  filePath: 'messages.json',
  token: process.env.EXPO_PUBLIC_GITHUB_TOKEN || null, // Load from environment variable
};

/**
 * Fetch messages.json from GitHub
 * @returns {Promise<Object>} { current, messages }
 */
export async function fetchMessages() {
  const { owner, repo, filePath, token } = GITHUB_CONFIG;

  if (!token) {
    console.warn('No GitHub token found. Using local fallback.');
    // Fallback: try to fetch from local server (for development)
    try {
      const response = await fetch('/messages.json');
      if (!response.ok) throw new Error('Local fetch failed');
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch messages locally:', error);
      // Return default fallback
      return {
        current: new Date().toISOString().split('T')[0],
        messages: {}
      };
    }
  }

  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // GitHub returns base64-encoded content
    const decodedContent = atob(data.content);
    const messagesData = JSON.parse(decodedContent);

    // Store SHA for future updates
    messagesData._sha = data.sha;

    return messagesData;
  } catch (error) {
    console.error('Failed to fetch messages from GitHub:', error);
    throw error;
  }
}

/**
 * Update messages.json on GitHub
 * @param {Object} messagesData - { current, messages }
 * @param {string} commitMessage - Commit message
 * @returns {Promise<Object>} Updated data with new SHA
 */
export async function updateMessages(messagesData, commitMessage = 'Update messages') {
  const { owner, repo, filePath, token } = GITHUB_CONFIG;

  if (!token) {
    console.error('No GitHub token found. Cannot update messages.');
    throw new Error('GitHub token required for updates');
  }

  try {
    // Extract SHA if it exists (needed for updates)
    const sha = messagesData._sha;

    // Remove SHA from data before encoding (don't want it in the file)
    const { _sha, ...cleanData } = messagesData;

    // Encode content as base64
    const content = btoa(JSON.stringify(cleanData, null, 2));

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: commitMessage,
        content: content,
        sha: sha, // Required for updates
        branch: GITHUB_CONFIG.branch,
      }),
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    // Return updated data with new SHA
    return {
      ...cleanData,
      _sha: result.content.sha,
    };
  } catch (error) {
    console.error('Failed to update messages on GitHub:', error);
    throw error;
  }
}

/**
 * Get current message (convenience function)
 * @returns {Promise<Object>} { text, words }
 */
export async function getCurrentMessage() {
  try {
    const data = await fetchMessages();
    const currentDate = data.current;
    const currentMessage = data.messages[currentDate];

    if (!currentMessage) {
      console.warn(`No message found for current date: ${currentDate}`);
      return null;
    }

    return currentMessage;
  } catch (error) {
    console.error('Failed to get current message:', error);
    return null;
  }
}

/**
 * Update a specific date's message
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} text - Message text
 * @returns {Promise<Object>} Updated messages data
 */
export async function updateMessageForDate(date, text) {
  try {
    // Fetch current data
    const messagesData = await fetchMessages();

    // Split text into words
    const words = text.toLowerCase().split(/\s+/).filter(word => word.length > 0);

    // Update message for the date
    messagesData.messages[date] = { text, words };

    // Save back to GitHub
    const updated = await updateMessages(
      messagesData,
      `Update message for ${date}`
    );

    return updated;
  } catch (error) {
    console.error(`Failed to update message for ${date}:`, error);
    throw error;
  }
}

/**
 * Set current active message date
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Object>} Updated messages data
 */
export async function setCurrentDate(date) {
  try {
    // Fetch current data
    const messagesData = await fetchMessages();

    // Update current date
    messagesData.current = date;

    // Save back to GitHub
    const updated = await updateMessages(
      messagesData,
      `Set current message to ${date}`
    );

    return updated;
  } catch (error) {
    console.error(`Failed to set current date to ${date}:`, error);
    throw error;
  }
}

/**
 * Save a message and optionally make it current (Send Now)
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} text - Message text
 * @param {boolean} makeCurrent - Whether to set as current message
 * @returns {Promise<Object>} Updated messages data
 */
export async function saveMessage(date, text, makeCurrent = false) {
  // Validation: Prevent saving invalid data
  if (!date || date === 'null' || date === 'undefined') {
    const error = new Error(`Invalid date: "${date}". Cannot save message.`);
    console.error(error);
    throw error;
  }

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    const error = new Error(`Invalid message text: "${text}". Cannot save empty message.`);
    console.error(error);
    throw error;
  }

  try {
    // Fetch current data
    const messagesData = await fetchMessages();

    // Split text into words
    const words = text.trim().toLowerCase().split(/\s+/).filter(word => word.length > 0);

    // Additional check: ensure we have words after processing
    if (words.length === 0) {
      const error = new Error(`Message contains no valid words: "${text}"`);
      console.error(error);
      throw error;
    }

    // Update message for the date
    messagesData.messages[date] = { text, words };

    // If makeCurrent, also update the current date pointer
    if (makeCurrent) {
      messagesData.current = date;
    }

    // Save back to GitHub
    const commitMsg = makeCurrent
      ? `Send message now: ${date}`
      : `Schedule message for ${date}`;

    const updated = await updateMessages(messagesData, commitMsg);

    return updated;
  } catch (error) {
    console.error(`Failed to save message for ${date}:`, error);
    throw error;
  }
}
