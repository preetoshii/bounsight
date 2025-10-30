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
- ✅ Record audio in admin UI
- ✅ Auto-transcribe with word-level timestamps
- ✅ Display transcription (read-only)
- ✅ Store audio in GitHub
- ✅ Play word segments on ball bounce
- ✅ Preview mode with recorded audio
- ❌ Text editing (low priority - re-record instead)
- ❌ Reference pad (low priority - future feature)
- ❌ Sentence break markers (low priority - future feature)

**Timeline:** ~2-3 weeks for full implementation

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
  "words": ["you", "are", "loved"],
  "wordTimings": [
    {"word": "you", "start": 0, "end": 300},      // ← words[0] aligns with wordTimings[0]
    {"word": "are", "start": 400, "end": 600},    // ← words[1] aligns with wordTimings[1]
    {"word": "loved", "start": 700, "end": 1200}  // ← words[2] aligns with wordTimings[2]
  ]
}
```

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
  2025-10-25.m4a
  2025-10-26.m4a
  2025-10-27.m4a
```

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
- All platforms: `.m4a` (AAC encoding, ~128kbps)
- Highly compressed and efficient
- Native support across web, iOS, and Android
- Single format simplifies storage and playback

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
player.seekTo(startTimeMs / 1000); // Convert ms to seconds
setTimeout(() => player.pause(), durationMs);
```

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

### 2. Sentence Break Button During Recording

**Idea:** Button that marks sentence boundaries while recording, creating metadata for special gameplay interactions.

**Use Case:** User recording multiple sentences, wants to mark where sentences end for gameplay features (jingles, points, pauses, etc.)

**Proposed UI:**
```javascript
{isRecording && (
  <View style={styles.recordingControls}>
    <Button onPress={markSentenceBreak}>
      ✂️ Mark Sentence Break
    </Button>
    <Text>Press when you finish a sentence</Text>
  </View>
)}
```

**How It Works:**
- User speaks: "you are brave"
- Presses "Mark Sentence Break" button
- Continues speaking: "you are loved"
- Button press creates timestamp marker

**Data Structure:**
```json
{
  "words": ["you", "are", "brave", "you", "are", "loved"],
  "wordTimings": [...],
  "sentenceBreaks": [2, 5]  // After word index 2 and 5
}
```

**Future Gameplay Uses:**
- Play jingle when reaching sentence break
- Award points for completing sentences
- Visual effects between sentences
- Pause/timing adjustments

**Edge Case Handling:** If user presses button mid-word or slightly early, system marks the word that STARTED before the button press as the last word of the sentence.

**Priority:** Low - Interesting feature but not essential for MVP

---

## 📱 User Experience

### Admin Recording Flow (MVP)
1. User opens admin portal, navigates to date card
2. Press "Record" button
3. Speak message with natural word gaps
4. Press "Stop" button
5. System processes: transcribe audio + detect word timings (via Google Cloud Speech-to-Text)
6. Display transcribed text (read-only)
7. If incorrect → "Re-record" button to try again
8. If correct → Press "Preview" button
9. Preview gameplay experience with voice
10. Press "Save" to deploy (uploads audio to GitHub + updates messages.json)

---

## 🎨 UI Components (MVP)

### Recording Card (Modified CalendarView Card)

**Replace text input with recording interface:**

```javascript
// Current edit mode → Replace with recording mode
<View style={styles.card}>
  <Text style={styles.date}>{date}</Text>

  {/* Recording State */}
  {!isRecording && !hasRecording && (
    <Button onPress={startRecording}>🎤 Record</Button>
  )}

  {isRecording && (
    <View>
      <Text>● Recording... {durationSeconds}s</Text>
      <Button onPress={stopRecording}>⏹️ Stop</Button>
    </View>
  )}

  {hasRecording && !transcription && (
    <ActivityIndicator />
    <Text>Transcribing...</Text>
  )}

  {transcription && (
    <View>
      <Text style={styles.transcription}>{transcription}</Text>
      <Button onPress={reRecord}>Re-record</Button>
      <Button onPress={openPreview}>Preview</Button>
    </View>
  )}
</View>
```

### Preview Mode (Existing, Minor Modifications)

**Keep existing preview mode, modify to:**
- Load audio from recorded file (not AI-generated)
- Play word segments using wordTimings

```javascript
// In GameCore - word reveal with audio segment playback
const playWordSegment = (wordIndex) => {
  const timing = message.wordTimings[wordIndex];
  audioPlayer.seekTo(timing.start / 1000);
  setTimeout(() => audioPlayer.pause(), timing.end - timing.start);
};
```

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

**New Fields:**
- `audioUrl`: Path to audio file in GitHub repo
- `wordTimings`: Array of timing objects with start/end in milliseconds

**Preserved Fields:**
- `text`: Full message text (from transcription)
- `words`: Array of individual words (from transcription)

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
