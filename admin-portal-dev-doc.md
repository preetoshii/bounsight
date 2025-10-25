# Bounsight – Admin Portal Design Document

## Overview

The admin portal is a minimal, elegant interface for scheduling and managing daily affirmation messages. It prioritizes thoughtful composition and preview-before-publish workflow while maintaining Bounsight's minimalist aesthetic.

---

## Design Principles

- **Minimal and fade-based**: No modals or popups. Views fade in/out smoothly.
- **Forced preview**: Must preview message in actual gameplay before publishing.
- **Single unified interface**: No separate "current" vs "scheduled" sections—all messages live in one calendar view.
- **Thoughtful composition**: Edit view provides focused, distraction-free space for writing.
- **Clear status**: ACTIVE badge shows which message users currently see.

---

## View Hierarchy

```
Calendar View
  ↓ (tap slot)
Edit View
  ↓ (tap Preview)
Preview Mode (actual game)
  ↓ (tap Send Now / Save)
Confirmation (only for ACTIVE messages)
  ↓ (confirm)
Calendar View
```

---

## 1) Calendar View

### Purpose
Browse and manage all messages in a scrolling timeline.

### Layout
- **Infinite vertical scroll**: Past messages at top, today in middle, future below
- **Each slot contains**:
  - Date (e.g., "Jan 24, 2025" or "Today" for current day)
  - Message preview (first 40 characters) or "Empty"
  - **ACTIVE badge** on current day's slot (if it's active)
- **Past messages**: Grayed out, read-only (tap shows view-only version)
- **Future empty slots**: Show inherited message preview in lighter text (e.g., "Repeating: you are loved...")
- **Top-right X button**: Exit admin portal, return to game

### Interactions
- **Tap editable slot** → Fade to Edit View
- **Tap past slot** → Show read-only view (for reference)
- **Scroll** → Load more dates as needed (infinite scroll)
- **Tap X** → Fade out admin portal, return to game

### Visual Style
- Dark background (`#0a0a0a`)
- Slots have subtle borders/dividers
- ACTIVE badge: small, minimal (white text on dark accent color)
- Typography: Clean, monospace-inspired (matching game aesthetic)

---

## 2) Edit View

### Purpose
Focused interface for composing/editing a message.

### Layout
- **Center-framed, minimal design**
- **Top bar**:
  - Back arrow (top-left) → Return to Calendar View
  - Date label (centered)
  - ACTIVE badge (if editing today's message)
- **Large text area**:
  - Multi-line input for message
  - Plenty of whitespace
  - Keyboard-friendly (mobile: takes up most of screen when typing)
- **Preview button** (bottom center): Primary CTA to move forward

### Interactions
- **Tap Back arrow** → Fade to Calendar View (discards unsaved changes)
- **Type in text area** → Compose message
- **Tap Preview** → Fade to Preview Mode (message loaded into game)

### Validation
- No character limit enforced (but reasonable lengths encouraged)
- Empty messages not allowed (Preview button disabled)

### Visual Style
- Same dark background
- Text area: subtle border, white text
- Preview button: prominent (white background, dark text, or inverse)
- Minimal chrome—focus on the writing experience

---

## 3) Preview Mode

### Purpose
Experience the message in actual gameplay before publishing.

### Layout
- **Full game view**: Message plays as it would for users
- **Overlay controls** (subtle, appear after a moment):
  - Back button (top-left): Return to Edit View
  - Save/Send Now button (bottom-center): Publish message

### Interactions
- **Play the game**: Bounce, see words appear, feel the experience
- **Tap Back** → Fade back to Edit View (keep editing)
- **Tap Save** (future message) → Fade to Calendar View, message saved
- **Tap Send Now** (ACTIVE message) → Fade to Confirmation

### Button Labels
- **Future message**: "Save" (schedules for that date)
- **Active message**: "Send Now" (immediate update)

### Visual Style
- Game renders normally
- Overlay buttons: semi-transparent background, fade in after 2 seconds
- Minimal intrusion on gameplay

---

## 4) Confirmation (Active Messages Only)

### Purpose
Prevent accidental immediate updates to the live message.

### Layout
- **Center overlay** on top of Preview Mode (game dimmed in background)
- **Text**: "Send this message to everyone now?"
- **Subtext**: "This will update immediately for all users."
- **Two buttons**:
  - Cancel (secondary): Return to Preview Mode
  - Confirm (primary): Publish and return to Calendar View

### Interactions
- **Tap Cancel** → Fade back to Preview Mode
- **Tap Confirm** → Update `current-message.json`, fade to Calendar View, show success indicator

### Visual Style
- Semi-transparent dark overlay
- White text, centered
- Buttons: Cancel (outlined), Confirm (filled)

---

## 5) Fade Transitions

All view transitions use smooth fade animations (300-400ms duration):

- **Calendar → Edit**: Calendar fades out, Edit fades in
- **Edit → Preview**: Edit fades out, game fades in
- **Preview → Confirmation**: Confirmation fades in (game stays visible but dimmed)
- **Confirmation → Calendar**: Confirmation + Preview fade out, Calendar fades in
- **Edit → Calendar** (back button): Edit fades out, Calendar fades in
- **Calendar → Game** (X button): Admin portal fades out, game continues

No slide animations, no modals popping up—everything is fade-based for minimal, calm UX.

---

## Data Model

### Message Storage

**For scheduled messages:**
- Store in GitHub repo as `scheduled-messages.json`:
```json
{
  "2025-01-25": {
    "text": "you are brave and capable of amazing things",
    "words": ["you", "are", "brave", "and", "capable", "of", "amazing", "things"]
  },
  "2025-01-26": {
    "text": "your presence matters more than you know",
    "words": ["your", "presence", "matters", "more", "than", "you", "know"]
  }
}
```

**For current/active message:**
- Lives in `current-message.json` (already exists):
```json
{
  "text": "you are loved beyond measure and nothing can change that",
  "words": ["you", "are", "loved", "beyond", "measure", "and", "nothing", "can", "change", "that"],
  "updatedAt": "2025-01-24T07:00:00.000Z"
}
```

### Update Logic

**Scheduled message (future date):**
1. Admin saves message in Edit View
2. Updates `scheduled-messages.json` via GitHub API
3. At 7:00 AM on that date, a scheduled job (or client-side check) promotes it to `current-message.json`

**Active message (immediate):**
1. Admin confirms "Send Now"
2. Directly updates `current-message.json` via GitHub API
3. All users get new message on next app launch

### Scheduled Job Options

**Option A: Client-side check (simplest for MVP)**
- On app launch, check current date
- If a scheduled message exists for today and current message is outdated, fetch and replace
- No separate backend needed

**Option B: GitHub Actions (more robust)**
- Daily cron job at 7:00 AM UTC
- Checks `scheduled-messages.json` for today's date
- Automatically updates `current-message.json`
- Reliable, no client dependencies

**Option C: Cloudflare Workers cron (future)**
- Similar to GitHub Actions but on Cloudflare
- If we migrate to Cloudflare for other reasons

**Recommendation for MVP: Option A** (client-side check). Simple, no additional infrastructure.

---

## Implementation Notes

### Component Structure

```
/src/admin/
  AdminPortal.jsx          # Root component, manages view state and fades
  CalendarView.jsx         # Scrolling calendar with slots
  EditView.jsx             # Message composition interface
  PreviewMode.jsx          # Game preview with overlay controls
  Confirmation.jsx         # Send Now confirmation dialog
  githubApi.js             # GitHub API calls for message updates
  scheduledMessages.js     # Logic for scheduled message management
```

### State Management

```javascript
// AdminPortal.jsx manages global admin state
const [currentView, setCurrentView] = useState('calendar'); // 'calendar' | 'edit' | 'preview' | 'confirmation'
const [editingDate, setEditingDate] = useState(null); // Date being edited
const [draftMessage, setDraftMessage] = useState(''); // Message being composed
const [scheduledMessages, setScheduledMessages] = useState({}); // All scheduled messages
```

### GitHub API Integration

**Read operations:**
- Fetch `current-message.json` on admin portal open
- Fetch `scheduled-messages.json` to populate calendar

**Write operations:**
- **Future message**: Update `scheduled-messages.json` with new entry
- **Active message**: Overwrite `current-message.json`

**Authentication:**
- GitHub personal access token (fine-grained, repo scope)
- Stored in app (client-side, protected by staircase unlock)

---

## Authentication (Staircase Pattern)

The admin portal is hidden until the staircase pattern is executed (see main dev doc Section 9).

**Integration:**
- Staircase validation happens in `GameCore.js`
- On successful validation, emit event/callback
- `GameApp.jsx` listens for unlock event
- Fades game out, fades `AdminPortal.jsx` in

**Exit:**
- Tap X in Calendar View → Fade admin out, game back in
- Admin stays unlocked for session (or timeout after N minutes of inactivity)

---

## Visual Design Reference

**Inspiration:** Monospace notes app, Linear app (minimal, fade-based), Stripe dashboard (clean, focused forms)

**Color Palette:**
- Background: `#0a0a0a` (dark)
- Text: `#ffffff` (white)
- Muted text: `#666666` (gray)
- Borders: `#222222` (subtle)
- Active badge: `#4a9eff` or similar accent
- Buttons: White fill for primary, outlined for secondary

**Typography:**
- Font: Inter (already loaded) or system monospace
- Weights: 300 (body), 400 (buttons), 600 (headings)
- Line height: 1.5-1.6 for readability

**Spacing:**
- Generous padding around text areas (24-32px)
- Slot height: 80-100px (comfortable tap targets)
- Button height: 48-56px

---

## Future Enhancements

- **Drafts**: Save drafts without publishing
- **Message history**: View analytics on past messages (engagement, etc.)
- **Templates**: Pre-written message suggestions
- **Bulk scheduling**: Import multiple messages at once
- **Collaboration**: Multi-admin support with permissions
- **Push notifications**: Notify when scheduled message goes live

---

## Technical Constraints

- Must work on web, iOS, and Android (React Native components)
- Keyboard handling on mobile (TextInput grows, shifts layout)
- Smooth 60fps fade animations (use Animated API or Reanimated)
- Handle network failures gracefully (retry logic, offline indicators)

---

## MVP Scope

**In scope:**
- Calendar View with infinite scroll
- Edit View with Preview button
- Preview Mode with actual gameplay
- Confirmation for active messages
- GitHub API integration for updates
- Fade transitions
- Basic error handling

**Out of scope (post-MVP):**
- GitHub Actions for scheduled jobs (use client-side check instead)
- Multi-admin support
- Message analytics
- Drafts feature
- Push notifications

---

## Development Checklist

- [ ] Create `AdminPortal.jsx` with view state management
- [ ] Build `CalendarView.jsx` with infinite scroll
- [ ] Build `EditView.jsx` with focused text area
- [ ] Build `PreviewMode.jsx` integrating game renderer
- [ ] Build `Confirmation.jsx` dialog
- [ ] Implement fade transitions between views
- [ ] Create `githubApi.js` with read/write methods
- [ ] Add `scheduled-messages.json` to repo
- [ ] Implement client-side scheduled message promotion logic
- [ ] Wire up staircase unlock to show admin portal
- [ ] Test full flow: unlock → schedule → preview → save → verify update
- [ ] Test immediate update flow for active message
- [ ] Handle edge cases (network errors, empty messages, etc.)

---

## Open Questions

1. **Scheduled message promotion**: Client-side check or GitHub Actions? (Leaning client-side for MVP)
2. **Session timeout**: Should admin auto-lock after inactivity? (Maybe 30 minutes)
3. **Conflict handling**: What if someone schedules for a date that already has a message? (Overwrite with confirmation)
4. **Empty dates**: Explicitly show "Repeating: [previous message]" or just leave empty until scheduled? (Show inherited message for clarity)
