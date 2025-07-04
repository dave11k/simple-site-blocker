// Simple Site Blocker - Blocked Page Script

// Motivational quotes array
const motivationalQuotes = [
  {
    text: "Focus is a matter of deciding what things you're not going to do.",
    author: "John Carmack",
  },
  {
    text: "The successful warrior is the average man with laser-like focus.",
    author: "Bruce Lee",
  },
  {
    text: "Concentrate all your thoughts upon the work at hand. The sun's rays do not burn until brought to a focus.",
    author: "Alexander Graham Bell",
  },
  {
    text: "Focus on being productive instead of busy.",
    author: "Tim Ferriss",
  },
  {
    text: "Where attention goes, energy flows and results show.",
    author: "T. Harv Eker",
  },
  {
    text: "It is during our darkest moments that we must focus to see the light.",
    author: "Aristotle",
  },
  {
    text: "The art of being wise is knowing what to overlook.",
    author: "William James",
  },
  {
    text: "Starve your distractions, feed your focus.",
    author: "Anonymous",
  },
  {
    text: "Focus is not saying yes to the thing you've got to focus on. It means saying no to the hundred other good ideas.",
    author: "Steve Jobs",
  },
  {
    text: "Your future is created by what you do today, not tomorrow.",
    author: "Robert Kiyosaki",
  },
];

// Get random quote
function getRandomQuote() {
  return motivationalQuotes[
    Math.floor(Math.random() * motivationalQuotes.length)
  ];
}

// Update quote display
function updateQuote() {
  const quote = getRandomQuote();
  document.getElementById("motivational-quote").textContent = `"${quote.text}"`;
  document.querySelector(".quote-author").textContent = `— ${quote.author}`;
}

// Get blocking state and update countdown
async function updateBlockedPage() {
  // Check if Chrome extension APIs are available
  if (typeof chrome === "undefined" || !chrome.runtime) {
    document.getElementById("countdown").textContent =
      "Extension context not available";
    return;
  }

  const maxRetries = 3;
  let retryCount = 0;

  const tryGetBlockingState = async () => {
    try {
      const response = await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error("Message timeout"));
        }, 5000);

        chrome.runtime.sendMessage(
          { action: "getBlockingState" },
          (response) => {
            clearTimeout(timeoutId);
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(response);
            }
          },
        );
      });

      if (response && response.success && response.data.isBlocking) {
        const endTime = response.data.blockEndTime;
        startCountdown(endTime);
      } else {
        document.getElementById("countdown").textContent =
          "No active blocking session";
      }
    } catch (error) {
      if (retryCount < maxRetries) {
        retryCount++;
        document.getElementById("countdown").textContent =
          `Retrying... (${retryCount}/${maxRetries})`;
        setTimeout(tryGetBlockingState, 1000);
      } else {
        // Try fallback: read directly from chrome.storage
        tryDirectStorageAccess();
      }
    }
  };

  tryGetBlockingState();
}

// Fallback: try to read blocking state directly from chrome.storage
async function tryDirectStorageAccess() {
  try {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(["blockingState"], (result) => {
        if (chrome.runtime.lastError) {
          document.getElementById("countdown").textContent =
            "Unable to access extension storage";
          return;
        }

        const blockingState = result.blockingState;
        if (
          blockingState &&
          blockingState.isBlocking &&
          blockingState.blockEndTime
        ) {
          startCountdown(blockingState.blockEndTime);
        } else {
          document.getElementById("countdown").textContent =
            "No active blocking session found";
        }
      });
    } else {
      document.getElementById("countdown").textContent =
        "Chrome storage API not available";
    }
  } catch (error) {
    document.getElementById("countdown").textContent = "Storage access failed";
  }
}

// Start countdown timer
function startCountdown(endTime) {
  const countdownElement = document.getElementById("countdown");

  const updateTimer = () => {
    const now = Date.now();
    const remaining = Math.max(0, endTime - now);

    if (remaining <= 0) {
      countdownElement.textContent = "Session ended - you can now browse!";
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      return;
    }

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

    countdownElement.textContent = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    setTimeout(updateTimer, 1000);
  };

  updateTimer();
}

// Show feedback message
function showFeedback(message, type) {
  const feedback = document.getElementById("save-feedback");
  feedback.textContent = message;
  feedback.className = `save-feedback ${type}`;
  feedback.classList.remove("hidden");

  setTimeout(() => {
    feedback.classList.add("hidden");
  }, 4000);
}

// Initialize page when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Auto-focus on text area when page loads
  document.getElementById("distraction-input").focus();

  // Handle save note
  document.getElementById("save-note").addEventListener("click", async () => {
    const noteText = document.getElementById("distraction-input").value.trim();

    if (!noteText) {
      showFeedback("Please enter a thought to save", "error");
      return;
    }

    try {
      await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: "addDistractionNote",
            data: noteText,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else if (response && response.success) {
              resolve(response);
            } else {
              reject(new Error("Failed to save note"));
            }
          },
        );
      });

      document.getElementById("distraction-input").value = "";
      showFeedback(
        "✅ Thought saved! Now get back to what matters.",
        "success",
      );

      // Change the placeholder after saving
      document.getElementById("distraction-input").placeholder =
        "Feeling distracted again? Write it down...";
    } catch (error) {
      showFeedback("❌ Failed to save. Please try again.", "error");
    }
  });

  // Handle attempt unblock
  document.getElementById("attempt-unblock").addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "openPopup" }, (response) => {
      if (chrome.runtime.lastError) {
        alert(
          "Please click the Simple Site Blocker extension icon to attempt unblocking",
        );
      }
    });
  });

  // Add small delay to ensure Chrome extension APIs are available
  setTimeout(() => {
    updateBlockedPage();
    updateQuote(); // Show a random quote on load
  }, 100);
});
