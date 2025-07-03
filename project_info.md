## Chrome Extension Project Plan: Site Blocker with Math Challenge

This document outlines the plan for developing a Chrome extension that allows users to block websites for a specified duration. To unblock sites before the timer expires, users must solve a series of math problems.

### 1. Project Overview

The "Simple Site Blocker" Chrome extension aims to help users improve their productivity by temporarily blocking distracting websites. It incorporates a unique "math challenge" mechanism to deter impulsive unblocking, encouraging users to stick to their focus goals.

### 2. Core Features

- **Website Blocking:** Block specified URLs or domains for a set period.
- **Time-Based Blocking:** Users can input hours and minutes for the blocking duration.
- **Profiles:**
  - Create, save, and manage multiple "profiles."
  - Each profile consists of a group of websites to block.
- **Math Challenge for Unblocking:**
  - If the user attempts to cancel blocking prematurely, they must solve a series of math problems.
  - **Difficulty Levels:**
    - Easy: 3 problems (e.g., single-digit addition/subtraction)
    - Medium: 5 problems (e.g., two-digit addition/subtraction, simple multiplication)
    - Hard: 7 problems (e.g., mixed operations, basic division, potentially negative numbers)
- **User Interface (UI):**
  - **Popup:** Quick access to start/stop blocking, select profiles, or manually enter sites.
  - **Options Page:** Full settings interface for managing profiles and setting math problem difficulty.
  - **Blocked Page:** A custom page displayed when a blocked site is accessed.

### 3. Technical Architecture

A Chrome extension typically consists of several parts:

- **`manifest.json`:** The heart of the extension, defining its metadata, permissions, and components.
- **Background Script (`background.js`):**
  - Runs in the background, continuously listening for events (e.g., tab updates, alarm triggers).
  - Manages the blocking logic, timer, and communication with other parts of the extension.
  - Handles Chrome Storage API interactions.
- **Popup Script (`popup.js`) & HTML (`popup.html`):**
  - The UI that appears when the extension icon is clicked.
  - Allows users to initiate blocking, select profiles, and interact with the math challenge.
- **Options Page Script (`options.js`) & HTML (`options.html`):**
  - A dedicated page for managing settings, creating/editing profiles, and setting math difficulty.
- **Content Script (`content.js` - _Optional, but useful for redirecting_):**
  - Injected into web pages. While the background script can handle redirects, a content script _could_ be used for more advanced page manipulation if needed (though for simple blocking, background is sufficient). We'll primarily use the background script for redirection.
- **Blocked Page HTML (`blocked.html`):**
  - A local HTML file that the background script redirects users to when they try to access a blocked site. This page will inform the user that the site is blocked and potentially offer the math challenge.

### 4. Data Storage

The Chrome Storage API (`chrome.storage.local`) will be used to persist user data. This includes:

- **Profiles:** An array of objects, where each object represents a profile with a name and an array of websites.

  ```
  // Example structure
  [
    {
      id: 'profile1',
      name: 'Work Focus',
      sites: ['facebook.com', 'instagram.com', 'youtube.com']
    },
    {
      id: 'profile2',
      name: 'Study Mode',
      sites: ['reddit.com', 'netflix.com']
    }
  ]

  ```

- **Blocking State:** An object containing the current blocking status.

  ```
  // Example structure
  {
    isBlocking: true,
    blockedSites: ['facebook.com', 'instagram.com'], // The currently active blocked sites
    blockEndTime: <timestamp>, // When blocking should end
    activeProfileId: 'profile1' // The profile currently active, if any
  }

  ```

- **Math Difficulty Setting:** A string ('easy', 'medium', 'hard').
- **Current Math Challenge State:** (Used when a challenge is active)
  - `problems`: Array of math problems (e.g., `{ question: '2 + 3', answer: 5 }`).
  - `currentProblemIndex`: Index of the problem the user is on.
- **Distraction Notes:** An array of objects, where each object represents a distraction thought.

  ```
  // Example structure
  [
    {
      timestamp: <timestamp>,
      note: 'Remember to buy groceries later.'
    },
    {
      timestamp: <timestamp>,
      note: 'Idea for new side project: AI-powered recipe generator.'
    }
  ]

  ```

### 5. User Interface (UI) Components

**5.1. Popup UI (`popup.html`, `popup.js`)**

- **Initial State:**
  - Input fields for "Hours" and "Minutes."
  - Dropdown for "Select Profile" (populated from stored profiles).
  - Textarea/Input for "Manually Enter Websites" (if no profile selected or for ad-hoc blocking).
  - "Start Blocking" button.
- **Blocking Active State:**
  - Displays "Blocking active for X hours Y minutes."
  - **Shows total time left on the block timer (e.g., "Time remaining: HH:MM:SS"). This will be continuously updated.**
  - "Cancel Blocking" button.
  - **"Distraction Thought" Section:**
    - Textarea for quick notes.
    - "Add Note" button.
    - (Optional: A small indicator or link to view all notes, which might open the options page or a dedicated notes page).
- **Math Challenge State (triggered by "Cancel Blocking" while active):**
  - Displays current math problem (e.g., "Problem 1/5: 2 + 3 = ?").
  - Input field for answer.
  - "Submit Answer" button.
  - "Go Back" button (to return to blocking active state without solving).
  - Error message display for incorrect answers.

**5.2. Options Page UI (`options.html`, `options.js`)**

- **Profile Management Section:**
  - List of existing profiles with "Edit" and "Delete" buttons.
  - "Create New Profile" button.
  - Form for creating/editing a profile:
    - Profile Name input.
    - Textarea for entering websites (one per line or comma-separated).
    - "Save Profile" / "Cancel" buttons.
- **Math Difficulty Setting Section:**
  - Radio buttons or dropdown for "Easy" (3), "Medium" (5), "Hard" (7) problems.
  - "Save Settings" button.
- **Distraction Notes View Section:**
  - A display area for all saved "Distraction Thoughts," possibly with timestamps.
  - (Optional: Buttons to delete individual notes or clear all notes).

**5.3. Blocked Page UI (`blocked.html`)**

- A simple HTML page informing the user that the site is blocked.
- Displays the reason (e.g., "This site is currently blocked by Simple Site Blocker until [End Time]").
- Optional: A button to "Attempt Unblock" which would open the popup to initiate the math challenge.

### 6. Core Logic

**6.1. Blocking Mechanism (Background Script)**

- **`webRequest` API:** Use `chrome.webRequest.onBeforeRequest` to intercept navigation requests.
- **Redirection:** If a requested URL matches a blocked site, redirect it to `chrome.runtime.getURL('blocked.html')`.
- **Matching Logic:** Implement robust URL matching (e.g., `hostname` comparison, wildcards if desired).

**6.2. Timer Management (Background Script)**

- When blocking starts, calculate the `blockEndTime` timestamp.
- Use `chrome.alarms.create` to set an alarm for when the blocking period expires.
- When the alarm fires, clear the blocking state.
- Continuously update remaining time in the popup by sending messages from the background script. This will involve the background script periodically calculating the remaining time and sending it to the popup, and the popup updating its display.

**6.3. Math Problem Generation and Validation (Background Script, Popup Script)**

- **Generation:**
  - Function to generate math problems based on difficulty:
    - Easy: `num1 + num2`, `num1 - num2` (single digits, ensure positive results for subtraction).
    - Medium: `num1 + num2`, `num1 - num2`, `num1 * num2` (two digits, simple multiplication).
    - Hard: `num1 + num2`, `num1 - num2`, `num1 * num2`, `num1 / num2` (division with integer results, potentially negative numbers).
  - Store problems and answers in the `chrome.storage.local` during a challenge.
- **Validation:**
  - When the user submits an answer, compare it to the stored correct answer.
  - If correct, advance to the next problem. If all problems are solved, clear blocking.
  - If incorrect, provide feedback and allow re-attempt.

**6.4. Profile Management (Options Page Script, Background Script)**

- **CRUD Operations:** Functions to Create, Read, Update, and Delete profiles in `chrome.storage.local`.
- **Validation:** Ensure profile names are unique and sites are in a valid format.

**6.5. Distraction Notes Management (Popup Script, Options Page Script, Background Script)**

- **Add Note:** In `popup.js`, capture the note text and timestamp, then save it to the `distractionNotes` array in `chrome.storage.local`.
- **View Notes:** In `options.js`, retrieve and display the `distractionNotes` from `chrome.storage.local`.

**6.6. Communication between Scripts**

- **`chrome.runtime.sendMessage` / `chrome.runtime.onMessage`:** For one-time requests (e.g., popup asking background for current blocking status, background notifying popup of timer updates, popup sending a new distraction note to background).
- **`chrome.extension.getBackgroundPage()`:** Popup can directly access background script functions/variables (less preferred for complex interactions, but simple for quick reads).

### 7. Development Steps (High-Level)

1. **Setup:**
   - Create `manifest.json` with basic permissions (`storage`, `activeTab`, `webRequest`, `alarms`).
   - Create empty `background.js`, `popup.html`, `popup.js`, `options.html`, `options.js`, `blocked.html`.
2. **Basic Blocking:**
   - Implement `webRequest` listener in `background.js` to redirect a hardcoded blocked site to `blocked.html`.
   - Create a simple `blocked.html`.
3. **Popup UI & Interaction:**
   - Design `popup.html` with input fields and buttons.
   - Implement `popup.js` to get input values and send messages to `background.js` to start/stop blocking.
   - **Add "Distraction Thought" textarea and "Add Note" button to `popup.html` and implement saving logic in `popup.js`.**
4. **Timer Logic:**
   - In `background.js`, implement logic to set `blockEndTime` and use `chrome.alarms`.
   - Update `popup.js` to display the countdown. **Ensure the remaining time is clearly displayed and updates in real-time.**
5. **Chrome Storage Integration:**
   - Use `chrome.storage.local` to save/retrieve blocking state, profiles, settings, **and distraction notes.**
6. **Options Page:**
   - Design `options.html` for profile management and difficulty settings.
   - Implement `options.js` to handle CRUD operations for profiles and save difficulty.
   - **Add a section to `options.html` to display saved distraction notes and implement retrieval/display logic in `options.js`.**
7. **Profile Selection/Manual Input:**
   - Update `popup.js` to populate the profile dropdown and handle manual site input.
8. **Math Challenge:**
   - Implement math problem generation in `background.js` (or a helper utility).
   - Design the math challenge UI in `popup.html`.
   - Implement logic in `popup.js` to display problems, get answers, validate, and clear blocking on success.
9. **Refinement & Testing:**
   - Thoroughly test all features, edge cases (e.g., no profiles, invalid input).
   - Improve UI/UX.
   - Add error handling and user feedback.

### 8. Future Enhancements

- **Whitelisting:** Allow users to specify sites that are _never_ blocked.
- **Scheduled Blocking:** Set recurring blocking schedules (e.g., "block social media every weekday from 9 AM to 5 PM").
- **Motivational Messages:** Display encouraging messages on the blocked page.
- **Statistics:** Track how often sites are blocked, unblocked, and math problems solved.
- **Different Challenge Types:** CAPTCHA, simple puzzles, typing tests.
- **Password Protection:** Require a password to access the options page or cancel blocking.

This plan provides a solid foundation for developing the Chrome extension.
