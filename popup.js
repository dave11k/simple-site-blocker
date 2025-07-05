// Simple Site Blocker Popup Script

document.addEventListener("DOMContentLoaded", async () => {
  await initializePopup();
  setupEventListeners();
});

// Initialize popup based on current state
async function initializePopup() {
  try {
    const response = await sendMessage({ action: "getBlockingState" });
    const blockingState = response.data;

    if (blockingState.isBlocking) {
      showBlockingState(blockingState);
      startTimer(blockingState.blockEndTime);
    } else {
      showInitialState();
    }

    await loadProfiles();
  } catch (error) {
    showError("Failed to load extension state");
  }
}

// Setup event listeners
function setupEventListeners() {
  // Initial state events
  document
    .getElementById("start-blocking")
    .addEventListener("click", startBlocking);
  document
    .getElementById("profile-select")
    .addEventListener("change", handleProfileChange);

  // Blocking state events
  document
    .getElementById("cancel-blocking")
    .addEventListener("click", showMathChallenge);
  document
    .getElementById("add-note")
    .addEventListener("click", addDistractionNote);

  // Math challenge events
  document
    .getElementById("submit-answer")
    .addEventListener("click", submitMathAnswer);
  document
    .getElementById("go-back")
    .addEventListener("click", showBlockingState);
  document.getElementById("math-answer").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      submitMathAnswer();
    }
  });

  // Options link
  document.getElementById("open-options").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

// Show initial state (not blocking)
function showInitialState() {
  document.getElementById("initial-state").classList.remove("hidden");
  document.getElementById("blocking-state").classList.add("hidden");
  document.getElementById("math-challenge").classList.add("hidden");
}

// Show blocking active state
function showBlockingState(blockingState) {
  document.getElementById("initial-state").classList.add("hidden");
  document.getElementById("blocking-state").classList.remove("hidden");
  document.getElementById("math-challenge").classList.add("hidden");

  if (blockingState) {
    updateBlockedSitesList(blockingState.blockedSites);
  }
}

// Show math challenge state
async function showMathChallenge() {
  try {
    const response = await sendMessage({ action: "generateMathChallenge" });
    const challengeState = response.data;

    document.getElementById("initial-state").classList.add("hidden");
    document.getElementById("blocking-state").classList.add("hidden");
    document.getElementById("math-challenge").classList.remove("hidden");

    displayMathProblem(challengeState);
  } catch (error) {
    showError("Failed to generate math challenge");
  }
}

// Start blocking
async function startBlocking() {
  try {
    const hours = parseInt(document.getElementById("hours").value) || 0;
    const minutes = parseInt(document.getElementById("minutes").value) || 0;
    const totalMinutes = hours * 60 + minutes;

    if (totalMinutes <= 0) {
      showError("Please enter a valid duration");
      return;
    }

    const profileId = document.getElementById("profile-select").value;
    const manualSites = document.getElementById("manual-sites").value.trim();

    let sites = [];

    if (profileId) {
      const profiles = await getProfiles();
      const profile = profiles.find((p) => p.id === profileId);
      if (profile) {
        sites = profile.sites;
      }
    } else if (manualSites) {
      sites = manualSites
        .split("\n")
        .map((site) => site.trim())
        .filter((site) => site.length > 0)
        .map((site) => cleanWebsiteURL(site));
    }

    if (sites.length === 0) {
      showError("Please select a profile or enter websites manually");
      return;
    }

    await sendMessage({
      action: "startBlocking",
      data: {
        sites: sites,
        duration: totalMinutes,
        profileId: profileId,
      },
    });

    const blockingState = {
      isBlocking: true,
      blockedSites: sites,
      blockEndTime: Date.now() + totalMinutes * 60 * 1000,
    };

    showBlockingState(blockingState);
    startTimer(blockingState.blockEndTime);
  } catch (error) {
    showError("Failed to start blocking");
  }
}

// Load profiles from storage
async function loadProfiles() {
  try {
    const profiles = await getProfiles();
    const select = document.getElementById("profile-select");

    // Clear existing options except the first one
    select.innerHTML = '<option value="">Select a profile</option>';

    profiles.forEach((profile) => {
      const option = document.createElement("option");
      option.value = profile.id;
      option.textContent = profile.name;
      select.appendChild(option);
    });
  } catch (error) {
    // Failed to load profiles - user can still enter sites manually
  }
}

// Get profiles from storage
async function getProfiles() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["profiles"], (result) => {
      resolve(result.profiles || []);
    });
  });
}

// Handle profile selection change
async function handleProfileChange() {
  const profileId = document.getElementById("profile-select").value;
  const manualSites = document.getElementById("manual-sites");

  if (profileId) {
    manualSites.value = "";
    manualSites.disabled = true;
    manualSites.placeholder = "Profile selected - manual entry disabled";
  } else {
    manualSites.disabled = false;
    manualSites.placeholder =
      "Enter websites manually (one per line)\\nExample:\\nfacebook.com\\nyoutube.com\\ntwitter.com";
  }
}

// Update blocked sites list
function updateBlockedSitesList(sites) {
  const list = document.getElementById("blocked-sites-list");
  list.innerHTML = "";

  // Check if sites is defined and is an array
  if (sites && Array.isArray(sites)) {
    sites.forEach((site) => {
      const li = document.createElement("li");
      li.textContent = site;
      list.appendChild(li);
    });
  }
}

// Start countdown timer
function startTimer(endTime) {
  const timerElement = document.getElementById("time-remaining");

  const updateTimer = () => {
    const now = Date.now();
    const remaining = Math.max(0, endTime - now);

    if (remaining <= 0) {
      showInitialState();
      return;
    }

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

    timerElement.textContent = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    setTimeout(updateTimer, 1000);
  };

  updateTimer();
}

// Add distraction note
async function addDistractionNote() {
  try {
    const noteText = document.getElementById("distraction-note").value.trim();

    if (!noteText) {
      showError("Please enter a note");
      return;
    }

    await sendMessage({
      action: "addDistractionNote",
      data: noteText,
    });

    document.getElementById("distraction-note").value = "";
    showSuccess("Note added successfully");
  } catch (error) {
    console.log(error);
    showError("Failed to add note");
  }
}

// Display math problem
function displayMathProblem(challengeState) {
  const currentProblem =
    challengeState.problems[challengeState.currentProblemIndex];
  const problemIndex = challengeState.currentProblemIndex + 1;
  const totalProblems = challengeState.problems.length;

  document.getElementById("problem-counter").textContent =
    `Problem ${problemIndex} of ${totalProblems}`;
  document.getElementById("problem-text").textContent =
    `${currentProblem.question} = ?`;
  document.getElementById("math-answer").value = "";
  document.getElementById("math-feedback").textContent = "";
  document.getElementById("math-answer").focus();
}

// Submit math answer
async function submitMathAnswer() {
  try {
    const answerInput = document.getElementById("math-answer");
    const answer = answerInput.value.trim();

    if (!answer) {
      showMathFeedback("Please enter an answer", "error");
      return;
    }

    const response = await sendMessage({
      action: "submitMathAnswer",
      data: answer,
    });

    const result = response.data;

    if (result.correct) {
      if (result.completed) {
        showMathFeedback(result.message, "success");
        setTimeout(() => {
          showInitialState();
        }, 2000);
      } else {
        showMathFeedback("Correct! Next problem...", "success");
        setTimeout(async () => {
          // Get the updated challenge state
          const challengeResponse = await sendMessage({
            action: "getMathChallengeState",
          });
          if (challengeResponse.success) {
            displayMathProblem(challengeResponse.data);
          }
        }, 1000);
      }
    } else {
      showMathFeedback("Incorrect. Try again!", "error");
      answerInput.value = "";
      answerInput.focus();
    }
  } catch (error) {
    showMathFeedback("Failed to submit answer", "error");
  }
}

// Show math feedback
function showMathFeedback(message, type) {
  const feedback = document.getElementById("math-feedback");
  feedback.textContent = message;
  feedback.className = `math-feedback ${type}`;
}

// Show error message
function showError(message) {
  // Create a temporary error notification
  const errorDiv = document.createElement("div");
  errorDiv.className = "error-notification";
  errorDiv.textContent = "Error: " + message;
  errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #e74c3c;
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    font-size: 14px;
    z-index: 1000;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  `;
  document.body.appendChild(errorDiv);

  // Remove after 3 seconds
  setTimeout(() => {
    if (errorDiv.parentNode) {
      errorDiv.parentNode.removeChild(errorDiv);
    }
  }, 3000);
}

// Show success message
function showSuccess(message) {
  // Create a temporary success notification
  const successDiv = document.createElement("div");
  successDiv.className = "success-notification";
  successDiv.textContent = message;
  successDiv.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #27ae60;
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    font-size: 14px;
    z-index: 1000;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  `;
  document.body.appendChild(successDiv);

  // Remove after 3 seconds
  setTimeout(() => {
    if (successDiv.parentNode) {
      successDiv.parentNode.removeChild(successDiv);
    }
  }, 3000);
}

// URL cleaning function to handle user input formatting
function cleanWebsiteURL(url) {
  // Remove leading/trailing whitespace
  let cleanedURL = url.trim();

  // Handle empty string
  if (!cleanedURL) return "";

  // Remove protocol (http://, https://, ftp://, etc.)
  cleanedURL = cleanedURL.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "");

  // Remove www. prefix
  cleanedURL = cleanedURL.replace(/^www\./, "");

  // Remove trailing slash
  cleanedURL = cleanedURL.replace(/\/$/, "");

  // Remove path, query parameters, and fragments (keep only domain)
  cleanedURL = cleanedURL.split("/")[0];
  cleanedURL = cleanedURL.split("?")[0];
  cleanedURL = cleanedURL.split("#")[0];

  // Convert to lowercase for consistency
  cleanedURL = cleanedURL.toLowerCase();

  return cleanedURL;
}

// Send message to background script
async function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (response && response.success) {
        resolve(response);
      } else {
        reject(new Error(response?.error || "Unknown error"));
      }
    });
  });
}
