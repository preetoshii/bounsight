# Audio Recording System: Design & Requirements Document

**Status:** ✅ Design Complete - Ready for Implementation
**Created:** 2025-10-29
**Last Updated:** 2025-10-29

---

## Document Purpose

This document defines the complete technical design and requirements for Bounsight's new audio-recording-first message system, replacing the previous AI-generated voice approach.

---

## Executive Summary

**Goal:** Replace AI-generated voice system with authentic recorded audio from the message creator.

**Approach:** Record → Transcribe → Store → Play word segments

**Key Technologies:**
- **Recording:** expo-audio (cross-platform)
- **Transcription & Word Timing:** Google Cloud Speech-to-Text API
- **Storage:** GitHub (same repo as messages.json)
- **Playback:** expo-audio player with segment seeking

**MVP Scope:**
- ✅ Record audio in admin UI with live waveform visualization
- ✅ Sentence break markers during recording (tap button to mark sentence boundaries)
- ✅ Auto-transcribe with word-level timestamps
- ✅ Display transcription (read-only)
- ✅ Store audio in GitHub with smart naming
- ✅ Play word segments on ball bounce with millisecond precision
- ✅ Auto-preview mode after transcription completes
- ❌ Text editing (low priority - re-record instead)
- ❌ Reference pad (low priority - future feature)

---

## Overview

Users will record affirmation messages directly in the admin UI. The system will automatically transcribe the audio and detect word boundaries using Google Cloud Speech-to-Text API. During gameplay, the ball reveals words one-by-one while playing the exact audio segment from the original recording.

---

## ✅ Decisions Made

### Data Structure
**Decision:** Use messages.json + separate audio files (Option A)

**Structure:**
```json
{
  "current": "2025-10-25",
  "messages": {
    "2025-10-25": {
      "text": "you are loved",
      "words": ["you", "are", "loved"],
      "audioUrl": "message-audio/2025-10-25.m4a",
      "wordTimings": [
        {"word": "you", "start": 0, "end": 300},
        {"word": "are", "start": 400, "end": 600},
        {"word": "loved", "start": 700, "end": 1200}
      ]
    }
  }
}
```

**Note:** Audio format is `.m4a` (AAC) on iOS/Android, `.webm` on web (handled by expo-audio)

**Rationale:**
- Minimal changes to existing system
- Text remains editable after recording
- Backward compatible (can have text-only messages)
- Clear separation: metadata in JSON, audio as files

---

## 🔧 Design Decisions (In Progress)

### 1. Speech-to-Text and Word Timing API Strategy ✅

**Decision:** Use Google Cloud Speech-to-Text API for both transcription AND word timing detection

**Rationale:**
- **Single source of truth:** Transcription and timings come from the same API call, eliminating synchronization issues
- **Guaranteed alignment:** No risk of off-by-one errors or mismatches between text and audio segments
- **Platform-agnostic:** REST API works identically on web, iOS, and Android
- **Professional accuracy:** Superior to device-native speech recognition APIs
- **Millisecond precision:** Exact word boundary timestamps (start/end times)
- **Cost-effective:** ~$0.024 per message (approximately $24 for 1000 messages)
- **Simple implementation:** Single API call returns everything we need

**Technical Details:**

**API:** Google Cloud Speech-to-Text v1
- Endpoint: `https://speech.googleapis.com/v1/speech:recognize`
- Pricing: $0.006 per 15 seconds of audio (~$0.024 per minute)
- Max audio length: 60 seconds (sufficient for affirmation messages)
- Supported formats: MP3, WAV, FLAC, OGG

**Request Configuration:**
```javascript
{
  audio: {
    content: base64AudioData  // or uri for cloud storage
  },
  config: {
    encoding: 'MP3',  // or 'LINEAR16' for WAV
    sampleRateHertz: 48000,
    languageCode: 'en-US',
    enableWordTimeOffsets: true,  // ← KEY: Returns word-level timestamps
    model: 'default'
  }
}
```

**Response Format:**
```json
{
  "results": [{
    "alternatives": [{
      "transcript": "you are loved",
      "confidence": 0.98,
      "words": [
        {
          "word": "you",
          "startTime": "0.0s",    // ← Start boundary of word
          "endTime": "0.3s",      // ← End boundary of word (both provided!)
          "confidence": 0.99
        },
        {
          "word": "are",
          "startTime": "0.4s",    // ← Start boundary
          "endTime": "0.6s",      // ← End boundary
          "confidence": 0.98
        },
        {
          "word": "loved",
          "startTime": "0.7s",    // ← Start boundary
          "endTime": "1.2s",      // ← End boundary
          "confidence": 0.97
        }
      ]
    }]
  }]
}
```

**Critical Feature:** Each word includes BOTH `startTime` and `endTime`, providing complete word boundaries needed for segmented audio playback.

**Data Transformation:**
Convert API response to our messages.json format:
```javascript
// API response → messages.json format
const processGoogleSpeechResponse = (response) => {
  const result = response.results[0].alternatives[0];

  return {
    text: result.transcript,
    words: result.words.map(w => w.word),
    wordTimings: result.words.map(w => ({
      word: w.word,
      start: parseTimeToMs(w.startTime),  // "0.3s" → 300
      end: parseTimeToMs(w.endTime)       // "0.6s" → 600
    }))
  };
};

const parseTimeToMs = (timeString) => {
  // "0.3s" → 300, "1.2s" → 1200
  return Math.round(parseFloat(timeString) * 1000);
};
```

**Implementation Flow:**
1. User records audio in admin UI
2. Audio file is captured as blob/buffer
3. Convert audio to base64 or upload to temporary storage
4. Send to Google Cloud Speech-to-Text API with `enableWordTimeOffsets: true`
5. Receive response with transcript and word-level timestamps
6. Transform response into messages.json format
7. Store audio file in `/message-audio/` directory
8. Update messages.json with text, words array, audioUrl, and wordTimings

**Environment Setup:**
```bash
# Add to .env
EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY=your_api_key_here
```

**Benefits Over Alternatives:**
- ❌ Client-side APIs (Web Speech API, iOS Speech, Android SpeechRecognizer): Don't provide word timestamps, inconsistent across platforms
- ❌ Manual audio analysis: Complex, error-prone, requires building word boundary detection from scratch
- ❌ Multiple APIs: Risk of misalignment between transcription and timing sources
- ✅ Google Cloud Speech-to-Text: Single call, guaranteed alignment, professional accuracy, minimal cost

**Addresses Open Questions:**
- ✅ Same API for transcription and word timing
- ✅ Reliable linking between text and audio segments (same source)
- ✅ Cross-platform consistency (REST API, not device-dependent)
- ✅ Simple approach (one API call)
- ✅ Both start AND end times provided for each word (complete boundaries)

---

### 3. Text-to-Audio Segment Alignment ✅

**Decision:** Alignment is inherently solved by using Google Cloud Speech-to-Text API

**How Alignment is Guaranteed:**

Google Cloud Speech-to-Text returns words and timestamps as **atomic units** in a single response:

```json
{
  "words": [
    {"word": "you", "startTime": "0.0s", "endTime": "0.3s"},
    {"word": "are", "startTime": "0.4s", "endTime": "0.6s"},
    {"word": "loved", "startTime": "0.7s", "endTime": "1.2s"}
  ]
}
```

**Why There Are No Alignment Issues:**

1. **Single Source:** Text and timings come from the same API call
2. **Atomic Units:** Each word object contains both text and its exact audio boundaries
3. **No Separate Matching:** We don't transcribe separately then detect timing - it's one operation
4. **Index Alignment:** Transform response using same array iteration:

```javascript
const words = apiResponse.words;

// Same array → guaranteed alignment by index
const textArray = words.map(w => w.word);           // ["you", "are", "loved"]
const timingsArray = words.map(w => ({              // [timing0, timing1, timing2]
  word: w.word,
  start: parseTimeToMs(w.startTime),
  end: parseTimeToMs(w.endTime)
}));
```

**Data Structure:**
```json
{
  "words": ["you", "are", "brave", "*", "you", "are", "loved"],
  "wordTimings": [
    {"word": "you", "start": 0, "end": 300},
    {"word": "are", "start": 400, "end": 600},
    {"word": "brave", "start": 700, "end": 1200},
    {"word": "*", "start": 1200, "end": 1200},     // ← Sentence break marker (zero duration)
    {"word": "you", "start": 1500, "end": 1800},
    {"word": "are", "start": 1900, "end": 2100},
    {"word": "loved", "start": 2200, "end": 2700}
  ]
}
```

**Sentence Break Marker:** Special asterisk character `"*"` inserted into words array at sentence boundaries with zero-duration timing. Gameplay can detect this and trigger jingle, award points, visual effects, etc.

**Gameplay Implementation:**
```javascript
// When ball bounces, reveal next word
const wordIndex = gameCore.currentWordIndex;

// Get word text and timing using SAME index
const word = message.words[wordIndex];              // "loved"
const timing = message.wordTimings[wordIndex];      // {start: 700, end: 1200}

// Play exact audio segment
audioPlayer.seekTo(timing.start / 1000);            // Seek to 0.7s
setTimeout(() => {
  audioPlayer.pause();
}, timing.end - timing.start);                      // Play for 500ms
```

**Why Off-By-One Errors Are Impossible:**
- ✅ Words and timings use same array index
- ✅ Both arrays created from same source in single transformation
- ✅ No manual matching or correlation step
- ✅ API guarantees word boundaries are accurate

**Complete Word Boundaries:**
- Each word has **both** `startTime` and `endTime`
- Know exactly when to start playback (startTime)
- Know exactly when to stop playback (endTime)
- No guessing or manual detection needed

**Addresses Open Questions:**
- ✅ Reliable linking between transcribed words and audio segments
- ✅ No risk of misalignment or off-by-one errors
- ✅ Both start and end timestamps provided
- ✅ Simple implementation with guaranteed correctness

---

### 4. Audio File Storage Location ✅

**Decision:** Store audio files in GitHub repository alongside messages.json (with migration path to CDN if needed later)

**Storage Structure:**
```
/message-audio/
  you-are-loved_2025-10-25.m4a
  you-deserve-good_2025-10-26.m4a
  your-presence-matters_2025-10-27.m4a
  you-are-loved_2025-10-27_02.m4a  ← Multiple recordings same day
```

**Naming Convention:** `{first-3-words}_{date}_{optional-counter}.m4a`
- First 3 words of transcription (lowercase, hyphenated)
- Date (YYYY-MM-DD)
- Optional counter (_02, _03) if multiple recordings same day
- Easy to browse, sort, and identify specific messages

**Rationale:**
- **Simplest implementation:** No new infrastructure or services required
- **Same API and authentication:** Use existing GitHub API integration and token
- **Atomic deployment:** Audio files and messages.json updated in single commit
- **Version control:** Audio files versioned alongside metadata
- **Sufficient capacity:** File sizes limited to 1-2MB per message, well within GitHub limits
- **Easy migration path:** Can move to CDN later without code changes

**Technical Details:**

**File Size Constraints:**
- Typical 1-minute high-quality recording: ~1-2MB
- GitHub file size limit: 100MB (far above our needs)
- GitHub repo size limit: 1GB free tier
- Capacity: ~500-1000 messages before considering migration

**Audio Format:**
- **All platforms:** `.m4a` (AAC encoding, ~128kbps)
- Highly compressed and efficient
- Native support across web, iOS, and Android
- Single format simplifies storage and playback
- **Web uses M4A:** Modern browsers (Chrome, Safari, Firefox, Edge) natively support audio/mp4 MIME type

**Upload Implementation:**
```javascript
import { uploadFile } from '../admin/githubApi';

// Upload audio file to GitHub
const uploadAudioToGitHub = async (audioUri, date) => {
  // Read audio file as base64
  const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
    encoding: FileSystem.EncodingType.Base64
  });

  // Upload to GitHub
  const path = `message-audio/${date}.m4a`;
  await uploadFile({
    path: path,
    content: base64Audio,
    message: `Add audio for message ${date}`
  });

  return path; // Return path for messages.json
};
```

**Deployment Workflow:**
```javascript
// Complete save workflow
const saveRecordedMessage = async (date, audioUri, transcriptionData) => {
  // 1. Upload audio file to GitHub
  const audioPath = await uploadAudioToGitHub(audioUri, date);

  // 2. Update messages.json with audio reference
  const updatedMessages = {
    ...messagesData.messages,
    [date]: {
      text: transcriptionData.text,
      words: transcriptionData.words,
      audioUrl: audioPath,
      wordTimings: transcriptionData.wordTimings
    }
  };

  // 3. Save messages.json to GitHub (atomic commit)
  await saveMessageToGitHub(updatedMessages);
};
```

**Audio Retrieval (Gameplay):**
```javascript
// Load message audio for playback
const loadMessageAudio = async (message) => {
  // Fetch audio from GitHub raw URL
  const audioUrl = `https://raw.githubusercontent.com/${owner}/${repo}/master/${message.audioUrl}`;

  // Load into audio player
  const player = useAudioPlayer(audioUrl);
  return player;
};
```

**GitHub API Endpoints Used:**
- `PUT /repos/{owner}/{repo}/contents/{path}` - Upload/update audio files
- `GET https://raw.githubusercontent.com/{owner}/{repo}/master/{path}` - Fetch audio for playback

**Version Control Benefits:**
- Audio files tracked in git history
- Can rollback to previous versions
- Changes visible in commit diffs
- Same deployment process as messages.json updates

**Future Migration Path (If Needed):**

If GitHub storage becomes limiting:

1. **Move audio to CDN** (Cloudflare R2, AWS S3, etc.)
2. **Update audioUrl in messages.json** to point to CDN URLs
3. **Zero game code changes** - still fetches from URL
4. **Gradual migration** - can move files incrementally

Example migration:
```json
{
  "audioUrl": "https://cdn.bounsight.com/message-audio/2025-10-25.m4a"
}
```

Game code remains identical - just fetches from different URL.

**When to Consider Migration:**
- Repo size approaches 1GB
- >500 messages stored
- Need faster CDN delivery globally
- Want to offload binary files from git

**Benefits Over Alternatives:**
- ❌ Cloudflare R2: Requires new service setup, API keys, separate authentication, added complexity
- ❌ Base64 in JSON: Massive file sizes, slow parsing, not practical
- ✅ GitHub: Works immediately, same infrastructure, version controlled, sufficient capacity

**Addresses Open Questions:**
- ✅ Simple storage solution with no new infrastructure
- ✅ File sizes limited and well within GitHub constraints
- ✅ Clear migration path if needs change
- ✅ Atomic deployment of audio + metadata

---

### 2. Cross-Platform Audio Recording Strategy ✅

**Decision:** Use `expo-audio` with `useAudioRecorder()` hook for cross-platform audio recording

**Rationale:**
- **Official replacement:** Audio from `expo-av` is deprecated; `expo-audio` is the current official solution
- **True cross-platform WYSIWYG:** Same code works identically on web, iOS, and Android
- **Modern React patterns:** Hook-based API (`useAudioRecorder`, `useAudioPlayer`) instead of class-based
- **Actively maintained:** Current stable version by Expo team
- **Focused library:** Dedicated to audio (not audiovisual like expo-av), better performance
- **Solves reliability issues:** Built to address known issues from expo-av

**Technical Details:**

**Package:** expo-audio v1.0.14
- Official Expo SDK package
- Cross-platform: Web, iOS, Android, tvOS
- Hooks-based API for React patterns
- Installation: `npx expo install expo-audio`

**Recording API:**
```javascript
import { useAudioRecorder, RecordingPresets } from 'expo-audio';

// Hook provides recorder instance
const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

// Start recording
await recorder.record();

// Stop recording and get URI
const uri = recorder.stop();

// Get audio file for upload
const audioFile = {
  uri: uri,
  name: `message-${date}.mp3`,
  type: 'audio/mpeg'
};
```

**Recording Presets:**
```javascript
RecordingPresets.HIGH_QUALITY = {
  android: {
    extension: '.m4a',
    outputFormat: AndroidOutputFormat.MPEG_4,
    audioEncoder: AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 128000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: IOSAudioQuality.MAX,
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 128000,
  },
  web: {
    mimeType: 'audio/mp4', // M4A works natively in all modern browsers
    bitsPerSecond: 128000,
  }
};
```

**Note:** Web browsers natively support M4A (AAC in MP4 container). Chrome, Safari, Firefox, and Edge all support `audio/mp4` MIME type.

**Playback API (for preview/testing):**
```javascript
import { useAudioPlayer } from 'expo-audio';

// Hook provides player instance
const player = useAudioPlayer(audioUri);

// Play audio
player.play();

// Seek to specific timestamp (for word playback)
// NOTE: Despite documentation, seekTo() uses MILLISECONDS, not seconds
player.seekTo(startTimeMs); // e.g., 700 for 700ms
setTimeout(() => player.pause(), durationMs);
```

**Millisecond Precision:**
- expo-audio's `seekTo()` uses **milliseconds** internally (despite docs saying seconds)
- Perfect for precise word segment playback
- Example: `player.seekTo(700)` seeks to 700ms (0.7 seconds)
- iOS allows tolerance settings for even greater precision if needed

**Audio Effects:**
- expo-audio does **NOT** support real-time audio effects (EQ, reverb, compression, filters)
- Focused on playback/recording only, not audio processing
- Web Audio API has full effects, but not available in React Native
- For MVP: No effects needed, just segment playback ✅

**Recording State Management:**
```javascript
import { useAudioRecorderState } from 'expo-audio';

const recorder = useAudioRecorder();
const state = useAudioRecorderState(recorder);

// state.isRecording - boolean
// state.durationMillis - current recording duration
// state.mediaServicesDidReset - device audio interruption

// React to state changes
useEffect(() => {
  if (state.isRecording) {
    console.log(`Recording: ${state.durationMillis}ms`);
  }
}, [state]);
```

**Implementation Flow:**
1. User clicks "Record" button in admin UI
2. Request microphone permissions via expo-audio
3. Start recording with `recorder.record()`
4. Show recording status with `useAudioRecorderState()`
5. User clicks "Stop" button
6. Stop recording with `recorder.stop()` → returns URI
7. Send audio file to Google Cloud Speech-to-Text API
8. Store audio file in GitHub `/message-audio/` directory

**Platform Consistency:**
- ✅ **Same API across platforms:** `useAudioRecorder()` works identically on web, iOS, Android
- ✅ **Testing guarantee:** Test on web during development = guaranteed to work on mobile
- ✅ **No platform-specific code:** Single implementation for all platforms
- ✅ **Expo handles differences:** Library abstracts platform-specific native APIs internally

**Migration from expo-av:**
- Replace `expo-av` with `expo-audio` for audio recording/playback
- Keep `expo-av` only if needed for game SFX (can migrate those later)
- Modern hooks API is cleaner than old expo-av class-based approach

**Benefits Over Alternatives:**
- ❌ Web Speech API + iOS Speech + Android SpeechRecognizer: Platform-specific implementations, no WYSIWYG
- ❌ expo-av Audio: Deprecated, known reliability issues with recording state
- ❌ react-native-audio-recorder-player: Third-party dependency, less maintained
- ✅ expo-audio: Official, maintained, modern, cross-platform, hook-based

**Addresses Open Questions:**
- ✅ WYSIWYG between web and mobile development
- ✅ Elegant abstraction of platform differences
- ✅ Single codebase for all platforms
- ✅ Reliable, actively maintained solution

---

### 5. Text Editing After Transcription ✅

**Decision:** Transcribed text is read-only for MVP (audio is source of truth), with possible low-priority text correction feature later

**Rationale:**
- **Recording-first philosophy:** Audio is the source of truth, not text
- **Simplicity:** No complex validation or re-alignment logic
- **Perfect alignment:** Audio and text always match
- **Fast to re-record:** 30 seconds to re-record if transcription significantly wrong
- **Quality control:** Ensures authentic voice experience

**MVP Implementation:**

Transcribed text is **displayed but not editable**.

```javascript
// After recording and transcription
<View>
  <Text style={styles.label}>Transcription:</Text>
  <Text style={styles.transcript}>{transcribedText}</Text>
  {/* Read-only display, no TextInput */}

  <View style={styles.actions}>
    <Button onPress={handleReRecord}>
      Re-record if incorrect
    </Button>

    <Button onPress={handlePreview}>
      Preview & Continue
    </Button>
  </View>
</View>
```

**Workflow:**
1. User records audio
2. System transcribes and displays text (read-only)
3. If transcription significantly wrong → re-record entire message
4. If transcription acceptable → preview → save

**Why Re-recording is Acceptable:**
- Recording takes 20-30 seconds
- Google transcription is highly accurate (~95%+)
- Speaking more clearly usually fixes transcription on retry
- Keeps implementation simple and reliable

**Future Enhancement (Low Priority):**

If minor transcription errors become frequent, add text correction feature:

**Use Case:** One or two words mis-transcribed, rest is perfect
- Example: "you are **lovd**" → want to fix to "loved" without re-recording

**Proposed Implementation:**
```javascript
// Low-priority feature for future
<View>
  <Text>Transcription:</Text>

  {words.map((word, index) => (
    <TouchableText
      key={index}
      value={word}
      onEdit={(newWord) => {
        // Update text only, leave audio/timings untouched
        words[index] = newWord;
        // wordTimings[index] remains same (plays original audio)
      }}
    />
  ))}

  <Text style={styles.note}>
    Note: Editing text doesn't change audio. Audio still plays original recording.
  </Text>
</View>
```

**How It Would Work:**
- User taps word to edit (inline editing)
- Changes text only (e.g., "lovd" → "loved")
- Audio timing unchanged (plays original "lovd" audio segment)
- Audio-text mismatch is acceptable for minor typos
- Word count remains same (no adding/removing words)

**Example:**
```json
{
  "words": ["you", "are", "loved"],        // ← "loved" corrected from "lovd"
  "wordTimings": [
    {"word": "you", "start": 0, "end": 300},
    {"word": "are", "start": 400, "end": 600},
    {"word": "lovd", "start": 700, "end": 1200}  // ← Still references original audio
  ]
}
```

When word 3 plays:
- Display: "loved" (corrected text)
- Audio: plays segment 700-1200ms (original "lovd" pronunciation)

**Constraints for Future Feature:**
- ✅ Can edit individual word spelling
- ✅ Audio timings remain unchanged
- ✅ Simple inline editing UI
- ❌ Cannot add new words (would have no audio)
- ❌ Cannot delete words (would leave orphaned audio)
- ❌ Cannot reorder words (timings would misalign)
- ⚠️ Audio may not perfectly match corrected text (acceptable tradeoff)

**Priority:** Low - Implement only if transcription accuracy becomes an issue in practice

**Addresses Open Questions:**
- ✅ Text editing strategy defined
- ✅ Simple MVP approach (read-only)
- ✅ Future enhancement path documented
- ✅ Audio remains source of truth

---

---

### 6. Sentence Break Markers ✅

**Decision:** Implement sentence break button during recording to mark sentence boundaries for future gameplay features

**Rationale:**
- **Enhanced gameplay:** Enable special interactions at sentence boundaries (jingles, points, pauses, visual effects)
- **Simple implementation:** Record timestamp when button pressed, insert marker in word array
- **Future flexibility:** Can add gameplay features without re-recording messages
- **User control:** Creator decides where meaningful breaks occur

**Recording UI:**

During recording, show "Sentence Break" button alongside recording controls:

```javascript
{isRecording && (
  <View style={styles.recordingControls}>
    <Button
      onPress={markSentenceBreak}
      style={styles.sentenceBreakButton}
    >
      ✂️ Sentence Break
    </Button>

    <View style={styles.recordingStatus}>
      <Text>● Recording... {durationSeconds}s</Text>
    </View>

    <Button onPress={stopRecording}>
      ⏹️ Stop
    </Button>
  </View>
)}
```

**User Workflow:**
1. User starts recording
2. Speaks: "you are brave"
3. Presses "Sentence Break" button
4. Continues speaking: "you are loved"
5. Stops recording
6. System inserts `"*"` marker at break point

**Data Structure:**

Sentence breaks represented as special `"*"` character in words array:

```json
{
  "text": "you are brave you are loved",
  "words": ["you", "are", "brave", "*", "you", "are", "loved"],
  "wordTimings": [
    {"word": "you", "start": 0, "end": 300},
    {"word": "are", "start": 400, "end": 600},
    {"word": "brave", "start": 700, "end": 1200},
    {"word": "*", "start": 1200, "end": 1200},     // ← Zero-duration marker
    {"word": "you", "start": 1500, "end": 1800},
    {"word": "are", "start": 1900, "end": 2100},
    {"word": "loved", "start": 2200, "end": 2700}
  ],
  "sentenceBreakIndices": [3]  // Optional: explicit list of marker positions
}
```

**Implementation Details:**

```javascript
// Track sentence breaks during recording
const sentenceBreaks = useRef([]);
const recordingStartTime = useRef(null);

const markSentenceBreak = () => {
  const currentTime = Date.now() - recordingStartTime.current;
  sentenceBreaks.current.push(currentTime);
  // Visual/audio feedback
  playSound('sentence-break-click');
};

// After transcription, insert markers
const insertSentenceBreaks = (transcription, breaks) => {
  const { words, wordTimings } = transcription;

  // For each sentence break timestamp
  breaks.forEach(breakTime => {
    // Find word that was spoken just before break
    const breakIndex = wordTimings.findIndex(
      (timing, idx) => {
        const nextTiming = wordTimings[idx + 1];
        return timing.end <= breakTime &&
               (!nextTiming || nextTiming.start > breakTime);
      }
    );

    // Insert marker after that word
    words.splice(breakIndex + 1, 0, "*");
    wordTimings.splice(breakIndex + 1, 0, {
      word: "*",
      start: breakTime,
      end: breakTime
    });
  });

  return { words, wordTimings };
};
```

**Gameplay Usage:**

```javascript
// In GameCore - detect sentence breaks
const revealNextWord = () => {
  const word = message.words[currentWordIndex];

  if (word === "*") {
    // Sentence break detected!
    playSound('sentence-complete-jingle');
    awardPoints(10);
    showVisualEffect('sparkle');
    // Don't display anything (invisible marker)
  } else {
    // Normal word reveal
    displayWord(word);
    playWordAudio(wordTimings[currentWordIndex]);
  }

  currentWordIndex++;
};
```

**Edge Case Handling:**

If user presses sentence break button mid-word or slightly early:
- System finds the word that STARTED before the button press
- Inserts marker AFTER that word completes
- Ensures marker is between words, not during a word

**Future Gameplay Features:**
- Play special jingle at sentence boundaries
- Award bonus points for completing sentences
- Visual effects (sparkles, screen flash) between sentences
- Pause/timing adjustments for dramatic effect
- Achievement tracking (sentences completed)

**Addresses MVP Requirements:**
- ✅ Sentence break markers are core MVP feature
- ✅ Simple button in recording UI
- ✅ Zero-duration marker in data structure
- ✅ Flexible for future gameplay enhancements

---

## 💡 Ideas for Future Implementation (Low Priority)

### 1. Reference Pad for Recording

**Idea:** Text input field where user can type their planned phrase before recording, visible during recording so they can read it while speaking.

**Use Case:** User often writes phrases before recording them, needs something to read while recording.

**Important:** Reference text is admin-facing only, NOT the official message text. Official text comes from speech-to-text transcription.

**Proposed UI:**
```javascript
<View style={styles.recordingCard}>
  {/* Reference Pad - Always visible */}
  <View style={styles.referencePad}>
    <Text style={styles.label}>Reference (optional):</Text>
    <TextInput
      placeholder="Type your message here to read while recording..."
      value={referenceText}
      onChangeText={setReferenceText}
      multiline
      editable={!isRecording}
    />
  </View>

  <Button onPress={isRecording ? stopRecording : startRecording}>
    {isRecording ? '⏹️ Stop Recording' : '🎤 Start Recording'}
  </Button>
</View>
```

**Workflow:**
1. User types reference text: "you are loved"
2. Clicks "Start Recording"
3. Reference stays visible while recording
4. User reads reference and speaks
5. Stops recording
6. System transcribes audio (reference text ignored)
7. Display transcription from audio, not reference

**Data Storage:** Reference text is NOT stored in messages.json (purely UI state)

**Priority:** Low - Not essential for MVP

---

## 📱 User Experience

### Admin Recording Flow (MVP) - Detailed UX

#### 1. Calendar View State
**Initial State (No Recording):**
- Date card shows **`+` button** in center
- Tapping `+` navigates to Edit View for that date

#### 2. Edit View - Ready to Record
**Layout:**
- **Top Left:** Back button (← returns to Calendar View)
- **Bottom Center:** Large "🎤 Record" button
- **Screen:** Minimal, ready for recording

```javascript
<View style={styles.editView}>
  {/* Top Navigation */}
  <Pressable style={styles.backButton} onPress={backToCalendar}>
    <Feather name="arrow-left" size={24} color="#fff" />
  </Pressable>

  {/* Date Display */}
  <Text style={styles.dateHeader}>{formattedDate}</Text>

  {/* Record Button (Not Recording) */}
  {!isRecording && (
    <Button
      style={styles.recordButton}
      onPress={startRecording}
    >
      🎤 Record
    </Button>
  )}
</View>
```

#### 3. Recording State
**When user presses Record button:**
- **Center:** Live audio waveform visualization (shows voice input)
- **Bottom Left:** "✂️ Sentence Break" button
- **Bottom Center:** "⏹️ Stop" button (replaces Record button)
- **Status:** "● Recording... {seconds}s" near waveform

```javascript
{isRecording && (
  <View style={styles.recordingView}>
    {/* Audio Waveform Visualization */}
    <View style={styles.waveformContainer}>
      <AudioWaveform
        audioLevel={currentAudioLevel}
        isRecording={true}
      />
      <Text style={styles.recordingStatus}>
        ● Recording... {durationSeconds}s
      </Text>
    </View>

    {/* Recording Controls */}
    <View style={styles.recordingControls}>
      {/* Sentence Break Button - Bottom Left */}
      <Button
        style={styles.sentenceBreakButton}
        onPress={markSentenceBreak}
      >
        ✂️ Sentence Break
      </Button>

      {/* Stop Button - Bottom Center */}
      <Button
        style={styles.stopButton}
        onPress={stopRecording}
      >
        ⏹️ Stop
      </Button>
    </View>
  </View>
)}
```

**User Actions During Recording:**
- Speak message naturally with word gaps
- Press "✂️ Sentence Break" between sentences (optional)
- Visual/audio feedback when sentence break marked
- Waveform shows real-time audio input
- Press "⏹️ Stop" when finished

#### 4. Post-Recording State
**After pressing Stop button:**
- **Bottom Left:** "↻ Redo" button (re-record from scratch)
- **Bottom Right:** "✓ Complete" button (confirm and transcribe)
- Waveform remains visible but static (playback visualization)

```javascript
{hasRecording && !isTranscribing && (
  <View style={styles.reviewView}>
    {/* Static Waveform */}
    <AudioWaveform
      audioLevel={recordedWaveform}
      isRecording={false}
    />

    {/* Review Controls */}
    <View style={styles.reviewControls}>
      {/* Redo - Bottom Left */}
      <Button
        style={styles.redoButton}
        onPress={redoRecording}
      >
        ↻ Redo
      </Button>

      {/* Complete - Bottom Right */}
      <Button
        style={styles.completeButton}
        onPress={confirmRecording}
      >
        ✓ Complete
      </Button>
    </View>
  </View>
)}
```

#### 5. Transcription Processing State
**After pressing Complete button:**
- **Complete button** transforms into **loading spinner**
- Text: "Transcribing..."
- No modals or overlays - simple inline loading indicator
- Processing via Google Cloud Speech-to-Text API

```javascript
{isTranscribing && (
  <View style={styles.transcribingView}>
    <AudioWaveform
      audioLevel={recordedWaveform}
      isRecording={false}
    />

    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#ffffff" />
      <Text style={styles.loadingText}>Transcribing...</Text>
    </View>
  </View>
)}
```

#### 6. Auto-Preview Mode
**After transcription completes:**
- **Automatically** navigates to Preview Mode (no manual button press)
- Full-screen gameplay preview with recorded audio
- Ball bounces on gelato, reveals words with voice segments
- Same preview experience as before, now with real voice

**Preview Mode UI:**
- **Top Left:** Back button (← returns to Edit View)
- **Bottom Center:** "💾 Save" or "Send" button
- **Game Canvas:** Full gameplay simulation

```javascript
// Auto-navigation after transcription
useEffect(() => {
  if (transcriptionComplete) {
    // Automatically open preview
    setCurrentView('preview');
  }
}, [transcriptionComplete]);

// Preview Mode Component
<PreviewMode
  message={transcribedText}
  audioUrl={recordedAudioUri}
  wordTimings={wordTimings}
  onBack={backToEditView}
  onSave={saveMessage}
/>
```

**Preview Mode Actions:**
- User experiences full gameplay with their voice
- If satisfied → Press "💾 Save" to deploy
- If not satisfied → Press back, then "↻ Redo" to re-record

#### 7. Save/Deploy
**After pressing Save button:**
- Upload audio file to GitHub (`message-audio/{first-3-words}_{date}.m4a`)
- Update messages.json with transcription + wordTimings
- Show success confirmation
- Return to Calendar View (card now shows recording exists)

---

## 🎨 UI Components (MVP)

### 1. Calendar Card States

**Empty Card (No Recording):**
```javascript
<View style={styles.card}>
  <Text style={styles.date}>Oct 25, 2025</Text>
  <Pressable style={styles.addButton} onPress={() => openEdit(date)}>
    <Text style={styles.plusIcon}>+</Text>
  </Pressable>
</View>
```

**Card with Recording:**
```javascript
<View style={styles.card}>
  <Text style={styles.date}>Oct 25, 2025</Text>
  <View style={styles.messagePreview}>
    <Text style={styles.messageText}>you are loved</Text>
    <Feather name="mic" size={16} color="#888" />
  </View>
</View>
```

### 2. Edit View Component

**States:**
1. **Ready** - Show Record button
2. **Recording** - Show waveform, Sentence Break button, Stop button
3. **Review** - Show static waveform, Redo button, Complete button
4. **Transcribing** - Show loading spinner
5. **Preview** - Auto-navigate to preview mode

```javascript
<View style={styles.editView}>
  {/* Back Button */}
  <Pressable style={styles.backButton} onPress={backToCalendar}>
    <Feather name="arrow-left" size={24} />
  </Pressable>

  {/* Date Header */}
  <Text style={styles.dateHeader}>{formattedDate}</Text>

  {/* State-based Content */}
  {renderCurrentState()}
</View>
```

### 3. Audio Waveform Component

**Real-time visualization during recording:**
```javascript
<AudioWaveform
  audioLevel={currentAudioLevel}      // 0-1 amplitude
  isRecording={true}                   // Animating
  color="#4CAF50"                      // Green when recording
  height={100}
  style={styles.waveform}
/>
```

**Static visualization after recording:**
```javascript
<AudioWaveform
  audioLevel={recordedWaveform}        // Array of amplitudes
  isRecording={false}                  // Static
  color="#888888"                      // Gray when not recording
  height={100}
  style={styles.waveform}
/>
```

### 4. Recording Controls Layout

**Positioning:**
- Sentence Break button: Bottom Left
- Stop button: Bottom Center
- Maintains consistent positioning throughout recording

```javascript
<View style={styles.recordingControls}>
  <Button style={styles.leftButton}>✂️ Sentence Break</Button>
  <Button style={styles.centerButton}>⏹️ Stop</Button>
</View>

const styles = StyleSheet.create({
  recordingControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  leftButton: {
    flex: 1,
    marginRight: 20,
  },
  centerButton: {
    flex: 1,
  },
});
```

### 5. Review Controls Layout

**After stopping:**
```javascript
<View style={styles.reviewControls}>
  <Button style={styles.leftButton}>↻ Redo</Button>
  <Button style={styles.rightButton}>✓ Complete</Button>
</View>
```

### 6. Preview Mode Integration

**Modify existing PreviewMode component:**
- Accept `audioUrl` and `wordTimings` props
- Load audio file with expo-audio
- Play word segments using millisecond-precision seeking
- Keep existing game simulation

```javascript
// In GameCore - modified word reveal with audio playback
const revealNextWord = () => {
  const wordIndex = this.currentWordIndex;
  const word = this.message.words[wordIndex];
  const timing = this.message.wordTimings[wordIndex];

  // Check for sentence break marker
  if (word === "*") {
    // Sentence break - play jingle, no visual word
    playSound('sentence-jingle');
    this.currentWordIndex++;
    return;
  }

  // Normal word reveal
  this.currentWord = {
    text: word,
    timestamp: Date.now()
  };

  // Play audio segment (millisecond precision)
  if (this.audioPlayer) {
    this.audioPlayer.seekTo(timing.start);  // expo-audio uses milliseconds
    setTimeout(() => {
      this.audioPlayer.pause();
    }, timing.end - timing.start);
  }

  this.currentWordIndex++;
};
```

---

## 🎯 UX Flow Summary

1. **Calendar** → Tap `+` on empty card
2. **Edit (Ready)** → Press 🎤 Record button
3. **Edit (Recording)** → Speak + tap ✂️ for sentence breaks + press ⏹️ Stop
4. **Edit (Review)** → Press ↻ Redo OR ✓ Complete
5. **Edit (Transcribing)** → Loading spinner (automatic)
6. **Preview** → Automatic navigation, experience gameplay
7. **Preview** → Press 💾 Save to deploy
8. **Calendar** → Card now shows recording

---

## 🏗️ Technical Architecture

### System Flow

```
┌─────────────────┐
│  Admin Portal   │
│  (Recording UI) │
└────────┬────────┘
         │ 1. Record audio
         ▼
┌─────────────────┐
│   expo-audio    │
│  (Recording)    │
└────────┬────────┘
         │ 2. Audio file (.m4a/.webm)
         ▼
┌─────────────────┐
│  Google Cloud   │
│  Speech-to-Text │
└────────┬────────┘
         │ 3. Transcription + word timings
         ▼
┌─────────────────┐
│  GitHub API     │
│  (Storage)      │
└────────┬────────┘
         │ 4. Upload audio + update messages.json
         ▼
┌─────────────────┐
│ messages.json   │
│ + audio files   │
└────────┬────────┘
         │ 5. Fetch on game launch
         ▼
┌─────────────────┐
│   Game Client   │
│  (Playback)     │
└─────────────────┘
```

### Service Architecture

```javascript
// New service files needed
src/services/
  ├── audioRecordingService.js   // expo-audio wrapper
  ├── googleSpeechService.js     // Google Cloud Speech-to-Text API
  └── audioStorageService.js     // GitHub audio file upload
```

---

## 📊 Data Models

### messages.json (Updated Schema)

```json
{
  "current": "2025-10-25",
  "messages": {
    "2025-10-25": {
      "text": "you are brave you are loved",
      "words": ["you", "are", "brave", "*", "you", "are", "loved"],
      "audioUrl": "message-audio/you-are-brave_2025-10-25.m4a",
      "wordTimings": [
        {"word": "you", "start": 0, "end": 300},
        {"word": "are", "start": 400, "end": 600},
        {"word": "brave", "start": 700, "end": 1200},
        {"word": "*", "start": 1200, "end": 1200},
        {"word": "you", "start": 1500, "end": 1800},
        {"word": "are", "start": 1900, "end": 2100},
        {"word": "loved", "start": 2200, "end": 2700}
      ]
    }
  }
}
```

**New Fields:**
- `audioUrl`: Path to audio file in GitHub repo (smart naming: `{first-3-words}_{date}.m4a`)
- `wordTimings`: Array of timing objects with start/end in **milliseconds**

**Preserved Fields:**
- `text`: Full message text (from transcription, no sentence break markers in text)
- `words`: Array of individual words (includes `"*"` markers for sentence breaks)

**Sentence Break Markers:**
- Special `"*"` character in `words` array marks sentence boundaries
- Zero-duration timing (`start === end`)
- Not displayed visually, triggers gameplay events (jingles, points, effects)
- Inserted at timestamps when user pressed "✂️ Sentence Break" button during recording

### Audio File Storage

```
Repository structure:
/
├── messages.json
└── message-audio/
    ├── 2025-10-25.m4a
    ├── 2025-10-26.m4a
    └── 2025-10-27.m4a
```

---

## 🚀 Implementation Plan

### Phase 1: Core Recording & Transcription (Week 1)
1. Install `expo-audio` package
2. Create `audioRecordingService.js` with expo-audio wrapper
3. Modify CalendarView card to show recording UI
4. Implement record/stop functionality
5. Set up Google Cloud Speech-to-Text API
6. Create `googleSpeechService.js` for transcription
7. Display transcribed text in card

### Phase 2: Audio Storage & Deployment (Week 1-2)
1. Create `audioStorageService.js` for GitHub uploads
2. Implement audio file upload to GitHub
3. Update messages.json with audioUrl and wordTimings
4. Test end-to-end: record → transcribe → save → deploy

### Phase 3: Playback Integration (Week 2)
1. Modify GameCore to load audio file from GitHub
2. Implement word segment playback using wordTimings
3. Replace old audio playback logic with new system
4. Test preview mode with recorded audio

### Phase 4: Testing & Polish (Week 2-3)
1. Test on web, iOS, Android
2. Error handling (transcription failures, upload errors)
3. Loading states and user feedback
4. Re-record functionality
5. End-to-end testing

### Phase 5: Cleanup (Week 3)
1. Remove any remaining references to old audio system
2. Update documentation
3. Performance testing
4. Bug fixes

---

## 📚 References

- [Audio Recording Intentions Document](./audio-recording-intentions.md)
