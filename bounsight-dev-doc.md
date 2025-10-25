# Bounsight – Design & Dev Document (MVP → V1)

**One-liner:** A minimalist, cross-platform bounce game that reveals a short, insightful message **one word per bounce**. You draw temporary spring lines; the mascot (a falling ball/character) hits them, speaks the next word, and the line appears on screen with haptics. Messages are pushed from a simple admin page and sync to Web, iOS, and Android.

This document is a blueprint for emergent gameplay and development feel, not a rigid spec. The architecture is designed to support rapid iteration and tuning until the vibe is right.

---

## 0) Goals & Principles

### Why (creative intent)
- A playful vehicle for two brothers to express themselves and share messages they care about with people.
- The platform doubles as a tiny stage for our words while we make a fun, simple game—the medium we enjoy building.
- Repetition via play helps a message "settle in." The loop is meditative and affirmative without feeling like a lecture.

### Development Principles
- **Vibe-code friendly:** Keep the tech stack minimal and flexible. No heavy frameworks or complex build pipelines. Direct manipulation of physics constants, immediate visual feedback.
- **Universal updates:** Server-side message and content updates that deploy instantly to all platforms. No app store submissions for content changes.
- **Radical simplicity:** Bias toward the simplest solution that works. Every feature and line of code must justify its existence.
- **Lightweight everything:** Small bundle sizes, minimal dependencies, fast load times. Use the smallest tool that solves the problem well—but if a larger library is truly necessary for core functionality (like Matter.js for physics), that's fine as long as total weight stays reasonable.
- **Single source of truth:** One codebase, one physics engine, one set of constants. Platform-specific code only for rendering and native APIs.
- **Clean modularity:** Components and modules should have clear, single responsibilities and live in their own spaces. Easy to find, easy to adjust, easy to reason about. But don't over-architect—modularize when it makes sense, not preemptively.
- **No bloat:** Resist feature creep. The game is about bouncing and hearing words. Everything else is secondary.

---

## 1) Player Experience

### Core loop
1. The mascot (ball/character) falls under gravity.
2. The player **draws a short line** (swipe). That line becomes a **springboard**.
3. On contact, the mascot bounces. **Each bounce speaks and displays the next word** of the message.
4. After the final word, the message **repeats** word-by-word on subsequent bounces. Height is a side effect; the message is the point.

### Controls
- **Create springboard (AKA "Gelato"):** Two methods:
  - **Swipe:** Swipe in any direction to instantly create a Gelato (straight line) in that direction
  - **Draw:** Touch and drag to draw; you'll see a preview path that follows your finger movement (see Drawing Mechanics below)

### Drawing Mechanics Implementation (TBD through experimentation)

**Core behavior (fixed):**
- Maximum distance allowed between start and end points (`maxGelatoLength`)
- On finger release: Always creates a straight-line Gelato between final start and end points
- Preview is purely visual feedback; final physics object is always a straight line

**Approach 1: Continuous Path with Sliding Start**
- Draw a continuous curved line following exact finger movement
- Start point begins where finger first touches
- When finger distance exceeds `maxGelatoLength`, start point slides along the historical path
- Maintains a "tail" of the most recent `maxGelatoLength` worth of path
- Visual: Smooth curved line, possibly with gradient fade on the older parts

**Approach 2: Segmented Printing (Bounce Sir style)**
- Instead of continuous line, "print" discrete segments at intervals along the path
- Each segment starts thin and expands to full size based on finger distance
- Within threshold distance: Current segment resizes and rotates toward finger
- Beyond threshold: Segment gets "printed" (locked in place), new segment begins
- When max length exceeded: Oldest segments disappear, maintaining the tail
- Visual: Series of connected segments (dots, capsules, or short lines)

**Key decisions to make during implementation:**
- Segment trigger distance (how far finger moves before printing new segment)
- Visual representation of "active" vs "printed" segments
- Smoothing/interpolation between finger samples for continuous feel
- How aggressively start point slides when exceeding max length
- Whether to show dotted/solid/gradient for different parts of preview

**Why this complexity matters:**
The preview mechanics directly impact game feel. Too responsive and it feels twitchy; too sluggish and it feels unresponsive. The segmented approach might feel more "intentional" while continuous might feel more "fluid." Only playtesting will reveal the right approach.

### Bouncing Mechanics

**Bounce direction:**
- Mascot bounces perpendicular to the Gelato's angle (along the normal vector)
- Not just "up" - if Gelato is angled, bounce direction matches that angle
- Creates more strategic placement opportunities

**Bounce strength:**
- Base restitution from Matter.js physics (tunable)
- Additional "spring boost" impulse applied on contact (tunable)
- Combined force determines bounce height/distance

**Wall behavior:**
- Configurable as either:
  - **Hard boundaries:** Mascot bounces off walls with restitution
  - **Wrap-around:** Mascot exits one side, enters the other (portal-style)
- Decision made via config constant

**Gravity:**
- Constant downward force (`gravityY`)
- Tunable strength affects fall speed and arc
- Consider range: 0.5 (floaty) to 2.0 (heavy)

**Air resistance:**
- `frictionAir` parameter prevents infinite acceleration
- Creates terminal velocity naturally
- Tunable for different feel (0.01 = slippery, 0.05 = dampened)

**Multiple bounce prevention:**
- Debounce timer (`minBounceIntervalMs`) prevents double-bouncing
- After bouncing a Gelato, brief immunity period before it can trigger again
- Prevents physics glitches and unintended multi-hits

**Velocity capping:**
- Maximum speed limits for X and Y velocity
- Prevents mascot from breaking camera bounds or physics engine
- Safety valve for extreme player inputs or physics edge cases

### Feedback
- **Visual:** the spoken word appears in the **center of the screen** on each bounce; gentle fade/float.
- **Haptic:**
  - Line placed → light tick.
  - Bounce/word reveal → medium impact.
- **Audio:** character voice says the word (see Voice System). Soft bounce SFX (optional, low-volume under voice).

### Progression (lightweight)
- The playfield scrolls upward as you keep bouncing; we track **height** (how far up you've climbed) as a light, score-like counter. It stays minimal and secondary to the message loop.

### Aesthetic
- Dark-mode, almost **MS-DOS-like** minimalism; clean typography and restrained palette.
- **Monospace-style** vibe (inspired by the "Monospace" notes app): ultra-simple UI with occasional, tasteful moments of fluidity/beauty.
- **Mascot:** a simple circle **with a face**, small talking mouth animations and a few expressions. The mascot is explicitly the **speaker** of the words. Face implementation TBD during development—may use Skia paths, sprites, or simple geometric shapes.

---

## 2) Content & Voice System

### Message definition
- **Message**: short sentence/line of wisdom.
- Stored as text; tokenized into **words** (see normalization).
- Each bounce advances `wordIndex = (wordIndex + 1) % words.length`.

### Normalization & tokenization
- Lowercase for audio reuse cache (preserve case where we want stylistic capitalization in metadata).
- **Message storage:** Store original message with punctuation in `current-message.json`. Strip punctuation only for display and audio lookup at runtime.
- Contractions treated as single words (e.g., "don't").
- **Punctuation interjections:** Map major stops (period, em-dash, ellipsis) to pre-recorded interjection sounds ("hm", "ah", etc.). These are system sounds generated once and stored alongside word audio. No on-screen glyph for punctuation.

### Audio generation & caching (ElevenLabs)
- **Workflow:** On message publish, back end tokenizes → checks each normalized word against an **Audio Dictionary**.
- **New word:** generate once via ElevenLabs TTS → store as `.wav/.mp3` in object storage (CDN-backed).
- **Existing word:** reuse stored audio; no re-generation costs.
- **Voice:** single curated voice ID for MVP (can expand later).
- **Parameters:** stable speed/pitch; can be configured per message if needed.

### Client playback
- **Load all word audio on startup**—messages are short enough (20-50 words) that we can just grab everything upfront.
- Maintain a simple **word audio queue**; each bounce triggers the next word's playback.
- Web: WebAudio (`AudioBufferSourceNode`).
- Mobile: `expo-av` for low latency; pre-load `Sound` instances.

### Storage & CDN
- `word_audio/{locale}/{voice_id}/{hash(word)}.wav`
- Cache headers: long TTL; versioning via path.
- Optional: bundle a tiny on-device cache by LRU to minimize repeat fetches.

---

## 3) Physics & Feel

### Engine
- **Matter.js (2D)** for physics
  - **Why:** Provides fine-grained control over restitution, friction, gravity, and impulse forces without the overhead of a full game engine. At 88kb, it's worth not debugging custom physics edge cases. Gives us the polish potential we need for great game feel while staying lightweight.
  - Use Matter.js's default runner for simplicity unless performance issues arise.

### Entities
- **Mascot (dynamic body):** circle; `restitution`, `frictionAir`, `mass` tunables.
- **Gelato (static/kinematic bodies):** created from swipes: a short rectangle aligned to gesture angle (length clamp, thickness).
- **Bounds:** **optional** left/right walls; we may experiment with **horizontal wrap** vs. hard bounds.

### Gelato behavior
- Contact with a Gelato triggers:
  - Normal physics bounce via restitution.
  - **Additional impulse** along the Gelato's normal (configurable "springiness").
  - Haptic + voice word emit + visual word popup.
- **Gelato lifetime rules:**
  - A Gelato **destructs after it's been bounced on once**, **or**
  - If a **new Gelato** is created while one exists, the previous Gelato is destroyed immediately.
  - Otherwise, the Gelato persists (no time-based auto-destruct).

### Tunable constants (expose in config.js at root)
- `gravityY`
- `restitution`, `friction`, `frictionAir`
- Gelato: `maxLength`, `thickness`, `springBoost`, `maxActiveGelatos`
- Bounce cadence guards: `minBounceIntervalMs`
- Haptics strengths per event
- Audio ducking: voice vs SFX ratio

> **Note:** All constants are **TBD and exploratory**. The feel will emerge through playtesting. The system is designed to be **expandable, swappable, and highly tweakable**—these are starting points, not final values.

---

## 4) Cross-Platform Rendering & Performance

### Single Renderer Architecture
- **React Native Skia everywhere** - one rendering codebase for all platforms
  - **Why:** Maintains our "single source of truth" principle. Change the ball color once, it updates on iOS, Android, and Web. No duplicate drawing logic. Skia is battle-tested (powers Chrome and Flutter) and gives us native performance with a unified API.
  - Mobile: Native Skia via `@shopify/react-native-skia`
  - Web: Same API via CanvasKit WASM (~2MB, acceptable trade-off for unified rendering)

### Frame loop
- `requestAnimationFrame` (Web) / Native Skia loop (Mobile)
- 60 FPS baseline with 120 FPS where device supports
- Avoid React state in hot loops; use refs/imperative stores

### Target
- Smooth, consistent experience across all platforms
- No visual differences between web and mobile
- Minimal bundle impact (CanvasKit is our biggest web dependency at ~2MB)

---

## 5) Architecture (End-to-End)

### Overview
- **Clients (Web, iOS, Android)** fetch the **current message** and word-audio URLs from a single backend.
- **Admin Web Portal** (simple password login) lets creators post a message.
- Backend tokenizes, generates **missing word audio** via ElevenLabs, stores audio, and marks the message **publishable**.
- Clients cache and play audio per bounce.

### Suggested stack

**Core Technologies & Why We Chose Them:**

- **App Framework: Expo (React Native) + react-native-web**
  - **Why:** Single codebase for iOS, Android, and Web. Expo handles the painful parts of React Native (build configs, native modules) while still giving us truly native apps. Yes, there's some development overhead (Metro bundler quirks, longer build times) but it's worth it for genuine native performance and feel (proper haptics, low-latency audio).

- **Physics: Matter.js**
  - **Why:** Sweet spot between control and simplicity. Gives us tweakable restitution, friction, gravity—all the micro-details for game feel—without a bloated game engine. At 88kb, it's light enough to vibe-code with but robust enough to handle edge cases we haven't thought of.

- **Renderer: React Native Skia (everywhere)**
  - **Why:** Single rendering codebase = single source of truth. Using `@shopify/react-native-skia` on mobile and CanvasKit (WASM) on web means we draw once and it looks identical everywhere. No maintaining two drawing implementations. The 2MB web bundle cost is worth the simplicity.

- **Haptics: expo-haptics + Web Vibration API**
  - **Why:** Native haptic feedback is crucial for game feel. Expo's API is simple and falls back gracefully on web. Note: Web haptics will be basic (simple vibration) compared to native's rich haptic patterns.

- **Audio: expo-av + WebAudio API**
  - **Why:** Low-latency audio playback for voice clips. Both APIs let us pre-load and trigger sounds instantly on bounce.

- **Backend: Cloudflare Workers + R2**
  - **Why:** Dead simple. No database needed—just JSON files and audio storage. Global CDN built-in. Workers for the admin API, R2 for storing word audio files. Scales automatically, costs almost nothing at our scale.

- **TTS: ElevenLabs API**
  - **Why:** Best voice quality and customization. Generate once per word, cache forever. Cost-effective since we only generate new words.

### Data model (minimal)
- **Current message:** Single `current-message.json` file containing:
  - Original message text (with punctuation preserved)
  - Tokenized word array (for consistency across clients)
  - Metadata (updatedAt, voiceId if needed)
- **Audio files:** Stored in R2/CDN as `audio/{word}.mp3`
- **System sounds:** Pre-recorded interjection sounds (`audio/system/hm.mp3`, `audio/system/ah.mp3`, etc.)
- No database, no relations, no complex state management
- **Why this simplicity:** We're not storing user data or message history. Just one current message that all clients fetch. This eliminates entire categories of bugs and complexity.

### Admin portal (simple UX)
- Single-page form: textarea for message, hit submit.
- Backend automatically generates any missing word audio via ElevenLabs.
- Simple password protection for MVP.
- One endpoint for clients: `GET /current-message.json` → `{ text, words, audioBaseUrl, updatedAt }`.

### Message fetch policy (client)
- Fetch on app start—that's sufficient for daily messages.
- Cache last message + audio files for offline play.

### Build & release
- One repo; EAS (Expo) for native builds; Vercel/Pages for web + admin.
- No app update needed for new messages; content pulled at runtime.

---

## 6) Implementation Plan (MVP)

**Milestone 0 – Scaffolding**
- Expo project setup with JavaScript (skip TypeScript for simpler vibe-coding)
- React Native Skia installed and verified (draw test circle)
- Matter.js installed and test physics world running
- Basic folder structure (game/, config.js at root, assets/)
- Verify runs on iOS simulator, Android emulator, and web browser
- Git repo initialized

**Milestone 1 – See Something**
- Mascot (circle) falls under gravity (visual only, no physics)
- Touch input draws lines on screen
- Dark background, basic Monospace aesthetic
- React Native Skia rendering working

**Milestone 2a – Physics Foundation**
- Connect Matter.js to visuals
- Basic gravity and collision detection working
- Mascot falls and can hit static objects
- Tunable constants file started (just gravity for now)
- Simple test obstacles to verify physics

**Milestone 2b – Drawing Gelatos**
- Implement touch input system (swipe vs draw detection)
- Create preview mechanism (try both continuous and segmented approaches)
- Handle max length constraints and start point sliding
- Convert preview to physical Gelato on release
- Gelato lifetime rules (destroy on bounce or when new one created)

**Milestone 2c – Bouncing Physics**
- Perpendicular bounce direction from Gelato normal vector
- Spring boost impulse addition to base restitution
- Debounce timer for multi-bounce prevention
- Wall behavior (test both bounce and wrap options)
- Air resistance and velocity capping
- Full tunable constants integrated

**Milestone 3 – The Message**
- Hardcoded message array for testing
- Word appears center-screen on each bounce
- Word index loops through message
- Basic haptic feedback on bounce
- Height counter as you climb
- **Game is now playable without audio**

**Milestone 4 – Admin Portal**
- Simple web form for message input
- Cloudflare Worker + R2 setup
- Store/retrieve current-message.json
- Client fetches message on app launch
- Test message updates without redeploy

**Milestone 5 – The Voice**
- ElevenLabs API integration
- Generate audio for new words on message publish
- Store word audio files in R2
- Client fetches and caches audio files
- Play word audio on bounce synchronized with text
- **Game is now feature complete**

**Milestone 6 – Ship Ready**
- Error handling (network failures, audio loading issues)
- Offline caching of last message and audio
- App store and web deployment configuration
- Final visual polish and performance optimization

---

## 7) Key Modules & Pseudocode

### File layout (proposed)
```
/apps
  /bounsight-app
    /src
      config.js               # All tunable constants at root for easy access
      game/
        core/GameCore.js      # physics, state, step(dt), events
        core/tokenize.js      # normalization rules
        input/Gestures.js     # swipe→segment, clamps, lifetime
        render/GameRenderer.jsx # Skia renderer for all platforms
        audio/VoiceQueue.js   # preload & sequential playback
        haptics/index.js      # expo-haptics + web fallback
      App.jsx
  /bounsight-admin
    (Next.js or Vite React SPA)
    pages/index.jsx           # login + form
    /api                      # serverless handlers

/packages
  /backend (Cloudflare Worker or Next API)
    routes/
      POST /admin/messages
      GET  /current-message.json
    lib/tts-elevenlabs.js
    lib/storage.js
```

### GameCore (sketch)
```ts
class GameCore {
  world: Matter.World
  mascot: Body
  gelatos: Body[]
  wordIndex = 0
  words: string[]
  onWord?: (word: string) => void

  step(dtMs: number) {
    // Use Matter.js default runner, don't overcomplicate
    Engine.update(engine, dtMs)
  }

  onCollision(a, b) {
    if (isMascotAndGelato(a, b) && debounceOK()) {
      applyGelatoImpulse(mascot, gelato, config.springBoost)
      this.emitWord()
      destroyGelatoIfSingleUse(gelato)
    }
  }

  emitWord() {
    const word = this.words[this.wordIndex]
    this.wordIndex = (this.wordIndex + 1) % this.words.length
    this.onWord?.(word)
  }
}
```

### SkiaRenderer (unified approach)
```jsx
// This same renderer works on ALL platforms
import { Canvas, Circle, Line, Path, vec } from '@shopify/react-native-skia'

export function GameRenderer({ gameState }) {
  return (
    <Canvas style={{ flex: 1 }}>
      {/* Mascot with face (implementation TBD) */}
      <Circle 
        cx={gameState.mascot.x} 
        cy={gameState.mascot.y} 
        r={30} 
        color="#69e"
      />
      {/* Face details to be added - may use Path or sprites */}
      
      {/* Gelatos */}
      {gameState.gelatos.map((gelato) => (
        <Line
          p1={vec(gelato.start.x, gelato.start.y)}
          p2={vec(gelato.end.x, gelato.end.y)}
          color="white"
          style="stroke"
          strokeWidth={4}
        />
      ))}
    </Canvas>
  )
}
```

### VoiceQueue (sketch)
```ts
class VoiceQueue {
  preload(words: string[]) { /* fetch & decode buffers */ }
  speak(word: string) { /* enqueue buffer; play if idle */ }
}
```

---

## 8) Haptics & Audio Details

### Haptics map (MVP)
- Gelato placed: `Impact Light`
- Bounce/word reveal: `Impact Medium`
- Tall combo (optional): `Notification Success`

### Audio priorities
- Voice is primary; bounce SFX subtle, side-chained or ducked.
- Prevent overlap: if another bounce occurs mid-word, either queue or truncate (configurable).
- Volume normalization per word during generation or at first decode.

---

## 9) In-App Admin Architecture

### Design Rationale

Admin functionality lives directly in the game app rather than a separate web portal. This means message updates happen within the game itself—no context switching, no separate deployment. The admin UX is as simple as the player UX.

### Gestural Password: The Staircase

Authentication is performed through gameplay rather than traditional credentials. The unlock pattern: **5 consecutive bounces where each bounce is progressively higher on screen AND each Gelato is progressively shorter (≥20% narrower each time).**

This approach:
- Uses existing game mechanics (no separate auth UI)
- Requires intentional skill to execute (won't happen accidentally)
- Feels like discovering a secret rather than logging in
- Even if reverse-engineered, must be physically performed

### Architecture

**Client-side (baked into app):**
- Staircase validation logic
- Admin UI components (hidden)
- GitHub API token

**Server-side (GitHub repo):**
- `current-message.json` (fetched by all users)

**Why split this way:**
The message must live outside the app so updates don't require app store resubmission or user reinstalls. The admin validation can live client-side because only 1-2 trusted admins exist, and the staircase pattern provides sufficient obscurity for this use case.

**Trade-offs:**
- Security through obscurity (not cryptographically secure)
- GitHub token discoverable if app is decompiled
- Client-side validation rules visible in source

These trade-offs are acceptable for a small creative project. Worst case: someone posts a silly message (revertable via git). The GitHub token is rotatable if compromised.

### Flow

**Players:**
1. Launch app → fetch `current-message.json` from GitHub → play

**Admins:**
1. Launch app → draw staircase pattern → admin panel appears → submit new message → GitHub file updates → all users get new message on next launch

### Implementation Sketch

```javascript
// Track last 5 bounces
this.recentBounces = []; // { y, gelatoWidth, timestamp }

onBounce(gelatoWidth) {
  this.recentBounces.push({
    y: this.mascot.position.y,
    gelatoWidth: gelatoWidth,
    timestamp: Date.now()
  });
  if (this.recentBounces.length > 5) this.recentBounces.shift();
  if (this.validateStaircase(this.recentBounces)) this.onAdminUnlock();
}

validateStaircase(bounces) {
  if (bounces.length < 5) return false;
  // Each bounce higher (Y decreasing)
  for (let i = 1; i < 5; i++) {
    if (bounces[i].y >= bounces[i-1].y) return false;
  }
  // Each gelato narrower (≤80% of previous)
  for (let i = 1; i < 5; i++) {
    if (bounces[i].gelatoWidth >= bounces[i-1].gelatoWidth * 0.8) return false;
  }
  return true;
}
```

GitHub API updates message file directly via token. Message tokenized into words array for consistency.

### Future Options

**If stronger security needed:** Migrate to Cloudflare Workers for server-side validation, move token to backend.

**If Apple flags hidden UI:** Make "Admin" button visible in settings (still gated by staircase), or note it in review comments as content management for authorized users.

**Additional obscurity:** Time-based unlock windows, multi-stage patterns, velocity/timing requirements.

This approach prioritizes simplicity and admin UX over maximum security—appropriate for a 2-person creative project.