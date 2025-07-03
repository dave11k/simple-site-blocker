// Simple Site Blocker Chrome Extension Background Script

// Storage keys
const STORAGE_KEYS = {
  BLOCKING_STATE: "blockingState",
  PROFILES: "profiles",
  MATH_DIFFICULTY: "mathDifficulty",
  DISTRACTION_NOTES: "distractionNotes",
  MATH_CHALLENGE_STATE: "mathChallengeState",
};

// Default blocking state
const DEFAULT_BLOCKING_STATE = {
  isBlocking: false,
  blockedSites: [],
  blockEndTime: null,
  activeProfileId: null,
};

// Initialize extension on startup
chrome.runtime.onStartup.addListener(async () => {
  await initializeExtension();
});

chrome.runtime.onInstalled.addListener(async () => {
  await initializeExtension();
});

// Initialize extension with default values
async function initializeExtension() {
  try {
    const result = await chrome.storage.local.get([
      STORAGE_KEYS.BLOCKING_STATE,
      STORAGE_KEYS.PROFILES,
      STORAGE_KEYS.MATH_DIFFICULTY,
      STORAGE_KEYS.DISTRACTION_NOTES,
    ]);

    // Set defaults if not exist
    if (!result[STORAGE_KEYS.BLOCKING_STATE]) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.BLOCKING_STATE]: DEFAULT_BLOCKING_STATE,
      });
    }

    if (!result[STORAGE_KEYS.PROFILES]) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.PROFILES]: [],
      });
    }

    if (!result[STORAGE_KEYS.MATH_DIFFICULTY]) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.MATH_DIFFICULTY]: "medium",
      });
    }

    if (!result[STORAGE_KEYS.DISTRACTION_NOTES]) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.DISTRACTION_NOTES]: [],
      });
    }

    // Clear any existing blocking if time has passed
    await checkBlockingStatus();
  } catch (error) {
    console.error("Failed to initialize extension:", error);
  }
}

// Check if current blocking should be cleared
async function checkBlockingStatus() {
  try {
    const result = await chrome.storage.local.get([
      STORAGE_KEYS.BLOCKING_STATE,
    ]);
    const blockingState =
      result[STORAGE_KEYS.BLOCKING_STATE] || DEFAULT_BLOCKING_STATE;

    if (blockingState.isBlocking && blockingState.blockEndTime) {
      const now = Date.now();
      if (now >= blockingState.blockEndTime) {
        await clearBlocking();
      }
    }
  } catch (error) {
    console.error("Failed to check blocking status:", error);
  }
}

// Handle web requests to block sites
chrome.webRequest.onBeforeRequest.addListener(
  async (details) => {
    try {
      const result = await chrome.storage.local.get([
        STORAGE_KEYS.BLOCKING_STATE,
      ]);
      const blockingState =
        result[STORAGE_KEYS.BLOCKING_STATE] || DEFAULT_BLOCKING_STATE;

      if (!blockingState.isBlocking || !blockingState.blockedSites) {
        return {};
      }

      const url = new URL(details.url);
      const hostname = url.hostname.toLowerCase();

      // Check if current site is blocked
      const isBlocked = blockingState.blockedSites.some((site) => {
        const cleanSite = site.toLowerCase().replace(/^www\./, "");
        const cleanHostname = hostname.replace(/^www\./, "");
        return (
          cleanHostname === cleanSite || cleanHostname.endsWith("." + cleanSite)
        );
      });

      if (isBlocked) {
        return {
          redirectUrl: chrome.runtime.getURL("blocked.html"),
        };
      }
    } catch (error) {
      console.error("Failed to handle web request:", error);
    }

    return {};
  },
  { urls: ["<all_urls>"] },
  ["blocking"],
);

// Handle alarms for blocking timer
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "blockingTimer") {
    await clearBlocking();
  }
});

// Handle messages from popup/options
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender, sendResponse);
  return true; // Keep message channel open for async response
});

// Handle different message types
async function handleMessage(request, sender, sendResponse) {
  try {
    switch (request.action) {
      case "startBlocking":
        await startBlocking(request.data);
        sendResponse({ success: true });
        break;

      case "stopBlocking":
        await clearBlocking();
        sendResponse({ success: true });
        break;

      case "getBlockingState":
        const state = await getBlockingState();
        sendResponse({ success: true, data: state });
        break;

      case "addDistractionNote":
        await addDistractionNote(request.data);
        sendResponse({ success: true });
        break;

      case "generateMathChallenge":
        const challenge = await generateMathChallenge();
        sendResponse({ success: true, data: challenge });
        break;

      case "submitMathAnswer":
        const result = await submitMathAnswer(request.data);
        sendResponse({ success: true, data: result });
        break;

      case "getMathChallengeState":
        const challengeState = await getMathChallengeState();
        sendResponse({ success: true, data: challengeState });
        break;

      default:
        sendResponse({ success: false, error: "Unknown action" });
    }
  } catch (error) {
    console.error("Message handling error:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// Start blocking with given parameters
async function startBlocking(data) {
  const { sites, duration, profileId } = data;
  const now = Date.now();
  const endTime = now + duration * 60 * 1000; // Convert minutes to milliseconds

  const blockingState = {
    isBlocking: true,
    blockedSites: sites,
    blockEndTime: endTime,
    activeProfileId: profileId || null,
  };

  await chrome.storage.local.set({
    [STORAGE_KEYS.BLOCKING_STATE]: blockingState,
  });

  // Set alarm for automatic clearing
  await chrome.alarms.create("blockingTimer", {
    when: endTime,
  });
}

// Clear blocking state
async function clearBlocking() {
  await chrome.storage.local.set({
    [STORAGE_KEYS.BLOCKING_STATE]: DEFAULT_BLOCKING_STATE,
  });

  // Clear math challenge state
  await chrome.storage.local.remove([STORAGE_KEYS.MATH_CHALLENGE_STATE]);

  // Clear alarm
  await chrome.alarms.clear("blockingTimer");
}

// Get current blocking state
async function getBlockingState() {
  const result = await chrome.storage.local.get([STORAGE_KEYS.BLOCKING_STATE]);
  return result[STORAGE_KEYS.BLOCKING_STATE] || DEFAULT_BLOCKING_STATE;
}

// Get math challenge state
async function getMathChallengeState() {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.MATH_CHALLENGE_STATE,
  ]);
  return result[STORAGE_KEYS.MATH_CHALLENGE_STATE] || null;
}

// Add distraction note
async function addDistractionNote(noteText) {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.DISTRACTION_NOTES,
  ]);
  const notes = result[STORAGE_KEYS.DISTRACTION_NOTES] || [];

  const newNote = {
    timestamp: Date.now(),
    note: noteText,
  };

  notes.push(newNote);

  await chrome.storage.local.set({
    [STORAGE_KEYS.DISTRACTION_NOTES]: notes,
  });
}

// Generate math challenge based on difficulty
async function generateMathChallenge() {
  const difficultyResult = await chrome.storage.local.get([
    STORAGE_KEYS.MATH_DIFFICULTY,
  ]);
  const difficulty = difficultyResult[STORAGE_KEYS.MATH_DIFFICULTY] || "medium";

  const problemCounts = {
    easy: 3,
    medium: 5,
    hard: 7,
  };

  const problems = [];
  const count = problemCounts[difficulty];

  for (let i = 0; i < count; i++) {
    problems.push(generateMathProblem(difficulty));
  }

  const challengeState = {
    problems: problems,
    currentProblemIndex: 0,
    difficulty: difficulty,
  };

  await chrome.storage.local.set({
    [STORAGE_KEYS.MATH_CHALLENGE_STATE]: challengeState,
  });

  return challengeState;
}

// Generate a single math problem
function generateMathProblem(difficulty) {
  switch (difficulty) {
    case "easy":
      return generateEasyProblem();
    case "medium":
      return generateMediumProblem();
    case "hard":
      return generateHardProblem();
    default:
      return generateMediumProblem();
  }
}

// Generate easy math problem
function generateEasyProblem() {
  const operations = ["+", "-"];
  const op = operations[Math.floor(Math.random() * operations.length)];
  let num1 = Math.floor(Math.random() * 10);
  let num2 = Math.floor(Math.random() * 10);

  // Ensure subtraction results in positive numbers
  if (op === "-" && num1 < num2) {
    [num1, num2] = [num2, num1];
  }

  const answer = op === "+" ? num1 + num2 : num1 - num2;
  return {
    question: `${num1} ${op} ${num2}`,
    answer: answer,
  };
}

// Generate medium math problem
function generateMediumProblem() {
  const operations = ["+", "-", "*"];
  const op = operations[Math.floor(Math.random() * operations.length)];
  let num1, num2;

  if (op === "*") {
    num1 = Math.floor(Math.random() * 10) + 1;
    num2 = Math.floor(Math.random() * 10) + 1;
  } else {
    num1 = Math.floor(Math.random() * 90) + 10;
    num2 = Math.floor(Math.random() * 90) + 10;
  }

  // Ensure subtraction results in positive numbers
  if (op === "-" && num1 < num2) {
    [num1, num2] = [num2, num1];
  }

  let answer;
  switch (op) {
    case "+":
      answer = num1 + num2;
      break;
    case "-":
      answer = num1 - num2;
      break;
    case "*":
      answer = num1 * num2;
      break;
  }

  return {
    question: `${num1} ${op} ${num2}`,
    answer: answer,
  };
}

// Generate hard math problem
function generateHardProblem() {
  const operations = ["+", "-", "*", "/"];
  const op = operations[Math.floor(Math.random() * operations.length)];
  let num1, num2;

  if (op === "*") {
    num1 = Math.floor(Math.random() * 15) + 1;
    num2 = Math.floor(Math.random() * 15) + 1;
  } else if (op === "/") {
    num2 = Math.floor(Math.random() * 10) + 1;
    num1 = num2 * (Math.floor(Math.random() * 10) + 1); // Ensure integer division
  } else {
    num1 = Math.floor(Math.random() * 100) + 1;
    num2 = Math.floor(Math.random() * 100) + 1;
  }

  // Allow negative results for hard problems
  let answer;
  switch (op) {
    case "+":
      answer = num1 + num2;
      break;
    case "-":
      answer = num1 - num2;
      break;
    case "*":
      answer = num1 * num2;
      break;
    case "/":
      answer = num1 / num2;
      break;
  }

  return {
    question: `${num1} ${op} ${num2}`,
    answer: answer,
  };
}

// Submit math answer
async function submitMathAnswer(userAnswer) {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.MATH_CHALLENGE_STATE,
  ]);
  const challengeState = result[STORAGE_KEYS.MATH_CHALLENGE_STATE];

  if (!challengeState) {
    throw new Error("No active math challenge");
  }

  const currentProblem =
    challengeState.problems[challengeState.currentProblemIndex];
  const isCorrect = parseInt(userAnswer) === currentProblem.answer;

  if (isCorrect) {
    challengeState.currentProblemIndex++;

    if (challengeState.currentProblemIndex >= challengeState.problems.length) {
      // Challenge completed, clear blocking
      await clearBlocking();
      return {
        correct: true,
        completed: true,
        message: "All problems solved! Blocking cleared.",
      };
    } else {
      // Move to next problem
      await chrome.storage.local.set({
        [STORAGE_KEYS.MATH_CHALLENGE_STATE]: challengeState,
      });
      return {
        correct: true,
        completed: false,
        currentProblem:
          challengeState.problems[challengeState.currentProblemIndex],
        problemIndex: challengeState.currentProblemIndex,
      };
    }
  } else {
    return {
      correct: false,
      completed: false,
      correctAnswer: currentProblem.answer,
      currentProblem: currentProblem,
      problemIndex: challengeState.currentProblemIndex,
    };
  }
}
