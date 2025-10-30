# Audio Recording System: Intentions, Open Questions, and Ideas

## 📋 Clear Intentions

### Data Structure
- **DECIDED:** Use messages.json + audio files approach (Option A)
  - Keep existing messages.json structure
  - Add `audioUrl` and `wordTimings` fields to each message
  - Store audio files separately (likely in /message-audio/ directory)

### User Experience Flow
- **Recording → Processing → Preview → Save**
  - Mirror the previous text-first workflow
  - Replace "type text" with "record audio"
  - Keep the preview button and preview mode
  - Keep the save/send final action
  - Preview mode should work with voice approach instead of AI-generated audio

### Development Principles
- **Minimal and lean app**
  - Simplest approach wherever possible
  - Avoid over-engineering
  - Keep codebase clean and maintainable

### Admin UI Requirements
- **Intuitive recording interface**
  - Clear visual feedback during recording
  - Easy to use and understand
  - Should feel natural and not cluttered

### Recording Environment Assumptions
- **Controlled, quiet environment**
  - Won't be recording in loud/noisy environments
  - Can rely on simple noise floor detection
  - Don't need complex audio filtering for background noise

---

## ❓ Open Questions

### 1. API Strategy for Speech-to-Text and Word Timing
- **Question:** Should we use a single API that does both transcription AND word timing detection?
- **Consideration:** Using one API seems cleaner than multiple tools, but is it the right approach?
- **Unknown:** What are the tradeoffs? Cost? Accuracy? Platform compatibility?

### 2. Cross-Platform Development Strategy
- **Question:** How do we ensure "what we see is what we get" between web testing and mobile deployment?
- **Concern:** If we use Web Speech API during development, but iOS/Android native APIs on mobile, how do we guarantee consistency?
- **Question:** What's an elegant approach to handle this difference?
- **Specific worry:** Different speech recognition engines might give different results

### 3. Linking Text to Audio Segments
- **Question:** How do we reliably link transcribed words to their corresponding audio segments?
- **Concern:** Risk of off-by-one errors or misalignment between word array and audio timestamps
- **Question:** What's the best way to ensure the word "love" in the transcript corresponds exactly to the "love" audio segment?
- **Worry:** Could there be mistakes or lack of proper syncing?

### 4. Audio Segmentation Technology
- **Question:** What's the best method to detect and extract word timing boundaries from audio?
- **Initial thought:** Noise floor detection (if volume > threshold, word is being spoken)
- **Concern:** How robust is simple noise floor detection?
- **Question:** What if voice has soft/quiet words? Will they be missed?
- **Question:** How do we distinguish voice from background noise in real-world conditions?
- **Preference:** Simplest approach that works reliably

### 5. Text Editing After Transcription
- **Question:** If the user edits the transcribed text (to fix transcription errors), what happens to word timings?
- **Options:**
  - Keep original audio timings (may not match edited text)
  - Re-align automatically (complex)
  - Prevent text editing (restrictive)
- **Unclear:** Best approach for this scenario

---

## 💡 Ideas & Feature Requests

### 1. Reference Pad for Recording
- **Problem:** User often writes down phrases before recording them, needs to read while recording
- **Solution:** Add a text input field that acts as a "reference pad"
  - User can type their planned phrase before recording
  - Visible during recording so they can read it
  - **Important:** This is REFERENCE ONLY, not the official text
  - The official text should come from speech-to-text transcription
  - Reference pad is purely admin-facing, not part of data structure

### 2. Sentence Break Button
- **Concept:** Button to mark sentence boundaries during recording
- **Workflow:**
  1. User is recording and speaking words
  2. When they finish a sentence, they press "Sentence Break" button
  3. This marks a break between the previous word and the next word
  4. Break is stored in data structure (could be special character or metadata)
- **Future use cases:**
  - Play a jingle when sentence break is reached during gameplay
  - Award points for completing a sentence
  - Visual effects or pause between sentences
  - Any number of creative gameplay elements
- **Edge case handling:** If user presses button mid-word or slightly early, system should recognize that the word they STARTED before pressing is the last word of the sentence

### 3. Recording UI Elements
- **Components needed:**
  - Record button (start/stop)
  - Reference pad (text input for user's prepared phrase)
  - Sentence break button (mark sentence boundaries during recording)
  - Visual feedback (waveform? recording indicator?)
  - Progress/status indication

### 4. Word Gap Strategy
- **Recording technique:** Speak with reasonable gaps between words
- **Purpose:** Assist in word boundary detection
- **Assumption:** User will naturally pause between words when reading prepared phrase
- **This helps:** Noise floor detection algorithm identify word boundaries

---

## 🔄 Workflow Summary (Refined from Ideas)

### Admin Recording Flow:
1. **Prepare:** User types reference phrase in reference pad (optional)
2. **Record:** Press record button, speak phrase while reading reference
3. **Mark boundaries:** Press sentence break button between sentences
4. **Process:** System transcribes audio and detects word timings
5. **Review:** Transcribed text appears (editable if wrong?)
6. **Preview:** Press preview button to test the experience
7. **Save:** If satisfied, press save/send button

### Data Generated:
- Audio file (stored in /message-audio/)
- Transcribed text (from speech-to-text API)
- Word array (from transcription)
- Word timings (start/end timestamps for each word)
- Sentence break markers (from button presses during recording)

---

## 🎯 Similar to Previous Approach (Keep These)

### Preserved Workflow Elements:
- ✅ Preview button and preview mode
- ✅ Save/send final action button
- ✅ Visual structure of admin UI
- ✅ Calendar card interface
- ✅ Testing the experience before committing

### What Changes:
- ❌ Type text input → ✅ Record audio
- ❌ AI audio generation step → ✅ Process recorded audio
- ❌ Word-by-word TTS → ✅ Segmented playback from single recording

---

## 🧩 Technical Considerations

### Word Timing Detection Method:
- **Likely approach:** Noise floor detection
  - Simple threshold-based detection
  - If amplitude > threshold, word is being spoken
  - Gaps between words = silence below threshold
- **Question:** Is this sufficient or do we need more sophisticated processing?

### Platform Compatibility:
- React Native project targeting web, iOS, Android
- Need consistent behavior across platforms
- Speech recognition APIs differ by platform
- **Challenge:** How to abstract this elegantly?

---

## 📝 Notes & Clarifications

- The reference pad text is NOT the official message text
- Official text comes from speech-to-text transcription
- Reference pad is a UX convenience, not a data source
- Sentence break button is pressed DURING recording, stored as metadata
- Word gap strategy relies on user speaking with natural pauses
- Preview mode should demonstrate the actual gameplay experience with voice

---

## Next Steps

Once these questions are resolved, we can create:
1. **Technical Design Document** - Detailed architecture and implementation plan
2. **API Selection Document** - Evaluate speech-to-text options and choose best fit
3. **UI/UX Wireframes** - Design the recording interface
4. **Implementation Roadmap** - Break down work into phases/milestones
