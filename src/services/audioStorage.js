/**
 * Audio Storage Service
 * Manages word audio dictionary and audio file storage in GitHub
 */

// GitHub configuration (reuse from githubApi)
const GITHUB_CONFIG = {
  owner: 'preetoshii',
  repo: 'bounsight',
  branch: 'master',
  token: process.env.EXPO_PUBLIC_GITHUB_TOKEN || null,
};

const DICTIONARY_PATH = 'word-audio/dictionary.json';
const AUDIO_BASE_PATH = 'word-audio/files';

/**
 * Fetch the word audio dictionary from GitHub
 * @returns {Promise<Object>} Dictionary mapping word -> {url, generatedAt}
 */
export async function fetchWordDictionary() {
  const { owner, repo, token } = GITHUB_CONFIG;

  if (!token) {
    console.warn('No GitHub token found. Using empty dictionary.');
    return {};
  }

  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${DICTIONARY_PATH}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (response.status === 404) {
      // Dictionary doesn't exist yet - return empty
      console.log('📖 No word dictionary found, starting fresh');
      return {};
    }

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const decodedContent = atob(data.content);
    const dictionary = JSON.parse(decodedContent);

    console.log(`📖 Loaded word dictionary: ${Object.keys(dictionary).length} words`);
    return dictionary;
  } catch (error) {
    console.error('Failed to fetch word dictionary:', error);
    return {}; // Return empty dictionary on error
  }
}

/**
 * Update the word audio dictionary in GitHub
 * @param {Object} dictionary - The updated dictionary object
 * @returns {Promise<void>}
 */
export async function updateWordDictionary(dictionary) {
  const { owner, repo, token } = GITHUB_CONFIG;

  if (!token) {
    throw new Error('GitHub token required to update dictionary');
  }

  try {
    // Get current file SHA (if exists)
    let sha = null;
    const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${DICTIONARY_PATH}`;

    try {
      const getResponse = await fetch(getUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (getResponse.ok) {
        const existingData = await getResponse.json();
        sha = existingData.sha;
      }
    } catch (getError) {
      // File doesn't exist yet, that's okay
      console.log('📝 Creating new word dictionary file');
    }

    // Encode dictionary as base64
    const content = btoa(JSON.stringify(dictionary, null, 2));

    // Update or create file
    const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${DICTIONARY_PATH}`;
    const response = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Update word audio dictionary (${Object.keys(dictionary).length} words)`,
        content: content,
        sha: sha, // Include SHA if updating existing file
        branch: GITHUB_CONFIG.branch,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    console.log('✓ Word dictionary updated successfully');
  } catch (error) {
    console.error('Failed to update word dictionary:', error);
    throw error;
  }
}

/**
 * Upload an audio file to GitHub
 * @param {string} word - The word (normalized)
 * @param {ArrayBuffer} audioData - Audio file data
 * @returns {Promise<string>} Public URL to the audio file
 */
export async function uploadAudioFile(word, audioData) {
  const { owner, repo, token } = GITHUB_CONFIG;

  if (!token) {
    throw new Error('GitHub token required to upload audio');
  }

  // Generate filename: word-audio/files/{word}.mp3
  const filename = `${word}.mp3`;
  const filepath = `${AUDIO_BASE_PATH}/${filename}`;

  try {
    // Convert ArrayBuffer to base64
    const bytes = new Uint8Array(audioData);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const content = btoa(binary);

    // Check if file already exists (get SHA)
    let sha = null;
    const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filepath}`;

    try {
      const getResponse = await fetch(getUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (getResponse.ok) {
        const existingData = await getResponse.json();
        sha = existingData.sha;
        console.log(`📝 Updating existing audio file for: "${word}"`);
      }
    } catch (getError) {
      console.log(`📝 Creating new audio file for: "${word}"`);
    }

    // Upload file
    const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filepath}`;
    const response = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Add audio for word: ${word}`,
        content: content,
        sha: sha,
        branch: GITHUB_CONFIG.branch,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();

    // Return raw GitHub URL for the file
    const publicUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${GITHUB_CONFIG.branch}/${filepath}`;

    console.log(`✓ Uploaded audio for "${word}": ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error(`Failed to upload audio file for "${word}":`, error);
    throw error;
  }
}

/**
 * Fetch audio file from URL
 * @param {string} url - Audio file URL
 * @returns {Promise<ArrayBuffer>} Audio data
 */
export async function fetchAudioFile(url) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
    }

    return await response.arrayBuffer();
  } catch (error) {
    console.error(`Failed to fetch audio file from ${url}:`, error);
    throw error;
  }
}
