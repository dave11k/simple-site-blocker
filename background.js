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

// Add logging and blocking for tab navigation attempts
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url && changeInfo.status === "loading") {
    // Check if this URL should be blocked
    const blockingState = await getBlockingState();
    if (blockingState.isBlocking && blockingState.blockedSites.length > 0) {
      const hostname = new URL(changeInfo.url).hostname.toLowerCase();
      const shouldBlock = blockingState.blockedSites.some((site) => {
        const cleanSite = site
          .toLowerCase()
          .replace(/^www\./, "")
          .replace(/^https?:\/\//, "")
          .replace(/\/$/, "");
        return (
          hostname === cleanSite ||
          hostname === `www.${cleanSite}` ||
          hostname.endsWith(`.${cleanSite}`)
        );
      });

      if (shouldBlock) {
        // Force redirect to blocked page
        try {
          await chrome.tabs.update(tabId, {
            url: chrome.runtime.getURL("blocked.html"),
          });
        } catch (error) {
          // Tab may have been closed or navigation prevented
        }
      }
    }
  }
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
    // Storage initialization failed - extension may still work with defaults
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
      } else {
        // Ensure rules are active if still blocking
        await updateBlockingRules(blockingState.blockedSites);
      }
    } else {
      // Clear any stale rules if not blocking
      await updateBlockingRules([]);
    }
  } catch (error) {
    // Failed to check blocking status - may continue with stale state
  }
}

// Update blocking rules using declarativeNetRequest
async function updateBlockingRules(sites) {
  try {
    // First, remove all existing rules
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIdsToRemove = existingRules.map((rule) => rule.id);

    if (ruleIdsToRemove.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIdsToRemove,
      });
    }

    if (!sites || sites.length === 0) {
      return; // No sites to block
    }

    // Create new blocking rules with comprehensive coverage
    const rules = [];
    sites.forEach((site, index) => {
      const cleanSite = site
        .toLowerCase()
        .replace(/^www\./, "")
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, ""); // Remove trailing slash

      // Rule 1: Block using requestDomains (most reliable approach)
      rules.push({
        id: index * 10 + 1,
        priority: 10,
        action: {
          type: "redirect",
          redirect: {
            url: chrome.runtime.getURL("blocked.html"),
          },
        },
        condition: {
          requestDomains: [cleanSite],
          resourceTypes: ["main_frame"],
        },
      });

      // Rule 2: Block using requestDomains with www
      rules.push({
        id: index * 10 + 2,
        priority: 10,
        action: {
          type: "redirect",
          redirect: {
            url: chrome.runtime.getURL("blocked.html"),
          },
        },
        condition: {
          requestDomains: [`www.${cleanSite}`],
          resourceTypes: ["main_frame"],
        },
      });

      // Rule 3: Block exact domain with HTTPS and any path
      rules.push({
        id: index * 10 + 3,
        priority: 9,
        action: {
          type: "redirect",
          redirect: {
            url: chrome.runtime.getURL("blocked.html"),
          },
        },
        condition: {
          urlFilter: `https://${cleanSite}/*`,
          resourceTypes: ["main_frame"],
        },
      });

      // Rule 4: Block www subdomain with HTTPS and any path
      rules.push({
        id: index * 10 + 4,
        priority: 9,
        action: {
          type: "redirect",
          redirect: {
            url: chrome.runtime.getURL("blocked.html"),
          },
        },
        condition: {
          urlFilter: `https://www.${cleanSite}/*`,
          resourceTypes: ["main_frame"],
        },
      });

      // Rule 5: Block exact domain without path (root) HTTPS
      rules.push({
        id: index * 10 + 5,
        priority: 8,
        action: {
          type: "redirect",
          redirect: {
            url: chrome.runtime.getURL("blocked.html"),
          },
        },
        condition: {
          urlFilter: `https://${cleanSite}`,
          resourceTypes: ["main_frame"],
        },
      });

      // Rule 6: Block www version without path (root) HTTPS
      rules.push({
        id: index * 10 + 6,
        priority: 8,
        action: {
          type: "redirect",
          redirect: {
            url: chrome.runtime.getURL("blocked.html"),
          },
        },
        condition: {
          urlFilter: `https://www.${cleanSite}`,
          resourceTypes: ["main_frame"],
        },
      });

      // Rule 7: Block exact domain with HTTP and any path
      rules.push({
        id: index * 10 + 7,
        priority: 7,
        action: {
          type: "redirect",
          redirect: {
            url: chrome.runtime.getURL("blocked.html"),
          },
        },
        condition: {
          urlFilter: `http://${cleanSite}/*`,
          resourceTypes: ["main_frame"],
        },
      });

      // Rule 8: Block www subdomain with HTTP and any path
      rules.push({
        id: index * 10 + 8,
        priority: 7,
        action: {
          type: "redirect",
          redirect: {
            url: chrome.runtime.getURL("blocked.html"),
          },
        },
        condition: {
          urlFilter: `http://www.${cleanSite}/*`,
          resourceTypes: ["main_frame"],
        },
      });

      // Rule 9: Block exact domain without path (root) HTTP
      rules.push({
        id: index * 10 + 9,
        priority: 6,
        action: {
          type: "redirect",
          redirect: {
            url: chrome.runtime.getURL("blocked.html"),
          },
        },
        condition: {
          urlFilter: `http://${cleanSite}`,
          resourceTypes: ["main_frame"],
        },
      });

      // Rule 10: Block www version without path (root) HTTP
      rules.push({
        id: index * 10 + 10,
        priority: 6,
        action: {
          type: "redirect",
          redirect: {
            url: chrome.runtime.getURL("blocked.html"),
          },
        },
        condition: {
          urlFilter: `http://www.${cleanSite}`,
          resourceTypes: ["main_frame"],
        },
      });
    });

    // Add the new rules
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: rules,
    });
  } catch (error) {
    // Failed to update blocking rules - blocking may not work properly
  }
}

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

  // Update declarativeNetRequest rules
  await updateBlockingRules(sites);

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

  // Clear all blocking rules
  await updateBlockingRules([]);

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
  let num1 = Math.floor(Math.random() * 90) + 10; // 2-digit numbers (10-99)
  let num2 = Math.floor(Math.random() * 90) + 10; // 2-digit numbers (10-99)

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
    num1 = Math.floor(Math.random() * 90) + 10; // 2-digit for multiplication
    num2 = Math.floor(Math.random() * 90) + 10; // 2-digit for multiplication
  } else {
    num1 = Math.floor(Math.random() * 900) + 100; // 3-digit numbers (100-999)
    num2 = Math.floor(Math.random() * 900) + 100; // 3-digit numbers (100-999)
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
