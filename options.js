// Simple Site Blocker Options Page Script

let currentEditingProfile = null;

document.addEventListener("DOMContentLoaded", async () => {
  await initializeOptionsPage();
  setupEventListeners();
});

// Initialize the options page
async function initializeOptionsPage() {
  try {
    await loadProfiles();
    await loadDifficultySetting();
    await loadDistractionNotes();
    await loadStatistics();
  } catch (error) {
    showNotification("Failed to load settings", "error");
  }
}

// Setup event listeners
function setupEventListeners() {
  // Profile management
  document
    .getElementById("create-profile")
    .addEventListener("click", showProfileForm);
  document
    .getElementById("cancel-profile")
    .addEventListener("click", hideProfileForm);
  document
    .getElementById("profile-form-element")
    .addEventListener("submit", saveProfile);

  // Math difficulty - auto-save on change
  document.querySelectorAll('input[name="difficulty"]').forEach((radio) => {
    radio.addEventListener("change", saveDifficulty);
  });

  // Distraction notes
  document
    .getElementById("clear-notes")
    .addEventListener("click", showClearNotesModal);

  // Statistics
  document
    .getElementById("reset-stats")
    .addEventListener("click", showClearDataModal);

  // Modal event listeners
  document
    .getElementById("edit-profile-form")
    .addEventListener("submit", handleEditProfileSubmit);
  document
    .getElementById("confirm-delete")
    .addEventListener("click", handleDeleteConfirmation);
  document
    .getElementById("confirm-clear-notes")
    .addEventListener("click", handleClearNotesConfirmation);
  document
    .getElementById("confirm-clear-data")
    .addEventListener("click", handleClearDataConfirmation);

  // Profile button event delegation
  document.getElementById("profile-list").addEventListener("click", (event) => {
    if (event.target.classList.contains("edit-btn")) {
      const profileId = event.target.getAttribute("data-profile-id");
      editProfile(profileId);
    } else if (event.target.classList.contains("delete-btn")) {
      const profileId = event.target.getAttribute("data-profile-id");
      deleteProfile(profileId);
    }
  });

  // Modal close event delegation
  document.addEventListener("click", (event) => {
    const action = event.target.getAttribute("data-action");
    if (action === "close-edit") {
      closeEditModal();
    } else if (action === "close-delete") {
      closeDeleteModal();
    } else if (action === "close-clear-notes") {
      closeClearNotesModal();
    } else if (action === "close-clear-data") {
      closeClearDataModal();
    }

    // Close modal when clicking overlay
    if (event.target.classList.contains("modal-overlay")) {
      if (event.target.closest("#edit-profile-modal")) {
        closeEditModal();
      } else if (event.target.closest("#delete-profile-modal")) {
        closeDeleteModal();
      } else if (event.target.closest("#clear-notes-modal")) {
        closeClearNotesModal();
      } else if (event.target.closest("#clear-data-modal")) {
        closeClearDataModal();
      }
    }
  });
}

// Load and display profiles
async function loadProfiles() {
  try {
    const profiles = (await getStorageData("profiles")) || [];
    const profileList = document.getElementById("profile-list");

    profileList.innerHTML = "";

    if (profiles.length === 0) {
      profileList.innerHTML =
        '<div class="empty-state">No profiles created yet. Create your first profile to get started!</div>';
      return;
    }

    profiles.forEach((profile) => {
      const profileElement = createProfileElement(profile);
      profileList.appendChild(profileElement);
    });
  } catch (error) {
    showNotification("Failed to load profiles", "error");
  }
}

// Create profile element
function createProfileElement(profile) {
  const div = document.createElement("div");
  div.className = "profile-item";
  div.innerHTML = `
        <div class="profile-info">
            <h4>${escapeHtml(profile.name)}</h4>
            <p>${profile.sites.length} websites: ${profile.sites
              .slice(0, 3)
              .map((site) => escapeHtml(site))
              .join(", ")}${profile.sites.length > 3 ? "..." : ""}</p>
        </div>
        <div class="profile-actions">
            <button class="edit-btn" data-profile-id="${profile.id}">Edit</button>
            <button class="delete-btn" data-profile-id="${profile.id}">Delete</button>
        </div>
    `;
  return div;
}

// Show profile form
function showProfileForm(isEdit = false) {
  document.getElementById("profile-form").classList.remove("hidden");
  document.getElementById("form-title").textContent = isEdit
    ? "Edit Profile"
    : "Create New Profile";

  if (!isEdit) {
    document.getElementById("profile-name").value = "";
    document.getElementById("profile-sites").value = "";
    currentEditingProfile = null;
  }
}

// Hide profile form
function hideProfileForm() {
  document.getElementById("profile-form").classList.add("hidden");
  document.getElementById("profile-name").value = "";
  document.getElementById("profile-sites").value = "";
  currentEditingProfile = null;
}

// Edit profile using modal
async function editProfile(profileId) {
  try {
    const profiles = (await getStorageData("profiles")) || [];
    const profile = profiles.find((p) => p.id === profileId);

    if (!profile) {
      showNotification("Profile not found", "error");
      return;
    }

    // Set current editing profile
    currentEditingProfile = profile;

    // Populate modal fields
    document.getElementById("edit-profile-name").value = profile.name;
    document.getElementById("edit-profile-sites").value =
      profile.sites.join("\n");

    // Show modal
    document.getElementById("edit-profile-modal").classList.remove("hidden");
  } catch (error) {
    showNotification("Failed to load profile for editing", "error");
  }
}

// Delete profile using modal
async function deleteProfile(profileId) {
  try {
    const profiles = (await getStorageData("profiles")) || [];
    const profile = profiles.find((p) => p.id === profileId);

    if (!profile) {
      showNotification("Profile not found", "error");
      return;
    }

    // Set the profile name in the modal
    document.getElementById("delete-profile-name").textContent = profile.name;

    // Store the profile ID for confirmation
    document
      .getElementById("confirm-delete")
      .setAttribute("data-profile-id", profileId);

    // Show modal
    document.getElementById("delete-profile-modal").classList.remove("hidden");
  } catch (error) {
    showNotification("Failed to load profile for deletion", "error");
  }
}

// Save profile
async function saveProfile(event) {
  event.preventDefault();

  try {
    const name = document.getElementById("profile-name").value.trim();
    const sitesText = document.getElementById("profile-sites").value.trim();

    if (!name || !sitesText) {
      showNotification("Please fill in all fields", "error");
      return;
    }

    const sites = sitesText
      .split("\n")
      .map((site) => site.trim())
      .filter((site) => site.length > 0)
      .map((site) => cleanWebsiteURL(site));

    if (sites.length === 0) {
      showNotification("Please enter at least one website", "error");
      return;
    }

    const profiles = (await getStorageData("profiles")) || [];

    if (currentEditingProfile) {
      // Update existing profile
      const index = profiles.findIndex(
        (p) => p.id === currentEditingProfile.id,
      );
      if (index !== -1) {
        profiles[index] = {
          ...currentEditingProfile,
          name: name,
          sites: sites,
        };
      }
    } else {
      // Create new profile
      const newProfile = {
        id: "profile_" + Date.now(),
        name: name,
        sites: sites,
      };
      profiles.push(newProfile);
    }

    await setStorageData("profiles", profiles);
    await loadProfiles();
    hideProfileForm();
    showNotification("Profile saved successfully", "success");
  } catch (error) {
    showNotification("Failed to save profile", "error");
  }
}

// Load difficulty setting
async function loadDifficultySetting() {
  try {
    const difficulty = (await getStorageData("mathDifficulty")) || "medium";
    document.querySelector(
      `input[name="difficulty"][value="${difficulty}"]`,
    ).checked = true;
  } catch (error) {}
}

// Save difficulty setting (auto-save)
async function saveDifficulty() {
  try {
    const difficulty = document.querySelector(
      'input[name="difficulty"]:checked',
    ).value;
    await setStorageData("mathDifficulty", difficulty);

    // Show subtle success indication
    const difficultyLabels = {
      easy: "Easy (3 problems)",
      medium: "Medium (5 problems)",
      hard: "Hard (7 problems)",
    };

    showNotification(
      `Math difficulty set to ${difficultyLabels[difficulty]}`,
      "success",
    );
  } catch (error) {
    showNotification("Failed to save difficulty setting", "error");
  }
}

// Load distraction notes
async function loadDistractionNotes() {
  try {
    const notes = (await getStorageData("distractionNotes")) || [];
    const notesList = document.getElementById("notes-list");

    notesList.innerHTML = "";

    if (notes.length === 0) {
      notesList.innerHTML =
        '<div class="empty-state">No distraction notes yet. Notes you add during blocking sessions will appear here.</div>';
      return;
    }

    // Sort notes by timestamp (newest first)
    notes.sort((a, b) => b.timestamp - a.timestamp);

    notes.forEach((note) => {
      const noteElement = createNoteElement(note);
      notesList.appendChild(noteElement);
    });
  } catch (error) {
    showNotification("Failed to load distraction notes", "error");
  }
}

// Create note element
function createNoteElement(note) {
  const div = document.createElement("div");
  div.className = "note-item";

  const date = new Date(note.timestamp);
  const dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString();

  div.innerHTML = `
        <div class="note-timestamp">${dateStr}</div>
        <div class="note-text">${escapeHtml(note.note)}</div>
    `;

  return div;
}

// Show clear notes modal
function showClearNotesModal() {
  document.getElementById("clear-notes-modal").classList.remove("hidden");
}

// Close clear notes modal
function closeClearNotesModal() {
  document.getElementById("clear-notes-modal").classList.add("hidden");
}

// Handle clear notes confirmation
async function handleClearNotesConfirmation() {
  try {
    await setStorageData("distractionNotes", []);
    await loadDistractionNotes();
    closeClearNotesModal();
    showNotification("All notes cleared", "success");
  } catch (error) {
    showNotification("Failed to clear notes", "error");
  }
}

// Load statistics
async function loadStatistics() {
  try {
    // For now, show placeholder statistics
    // In a real implementation, you'd track these metrics
    document.getElementById("total-sessions").textContent = "0";
    document.getElementById("total-time").textContent = "0h 0m";
    document.getElementById("early-unblocks").textContent = "0";
    document.getElementById("completed-sessions").textContent = "0";
  } catch (error) {}
}

// Show clear data modal
function showClearDataModal() {
  document.getElementById("clear-data-modal").classList.remove("hidden");
}

// Close clear data modal
function closeClearDataModal() {
  document.getElementById("clear-data-modal").classList.add("hidden");
}

// Handle clear data confirmation
async function handleClearDataConfirmation() {
  try {
    // Clear all extension storage keys
    const keysToRemove = [
      "blockingState",
      "profiles",
      "mathDifficulty",
      "distractionNotes",
      "mathChallengeState",
    ];

    // Clear each storage key
    await new Promise((resolve) => {
      chrome.storage.local.remove(keysToRemove, resolve);
    });

    // Also clear any blocking rules that might be active
    try {
      const existingRules =
        await chrome.declarativeNetRequest.getDynamicRules();
      if (existingRules.length > 0) {
        const ruleIdsToRemove = existingRules.map((rule) => rule.id);
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: ruleIdsToRemove,
        });
      }
    } catch (ruleError) {}

    // Clear any active alarms
    try {
      await chrome.alarms.clear("blockingTimer");
    } catch (alarmError) {}

    // Reload the page data to show empty state
    await initializeOptionsPage();
    closeClearDataModal();

    showNotification(
      "🧹 All extension data cleared successfully! Extension reset to clean state.",
      "success",
    );
  } catch (error) {
    showNotification("❌ Failed to clear all extension data", "error");
  }
}

// Modal control functions
function closeEditModal() {
  document.getElementById("edit-profile-modal").classList.add("hidden");
  document.getElementById("edit-profile-name").value = "";
  document.getElementById("edit-profile-sites").value = "";
  currentEditingProfile = null;
}

function closeDeleteModal() {
  document.getElementById("delete-profile-modal").classList.add("hidden");
  document.getElementById("confirm-delete").removeAttribute("data-profile-id");
}

// Handle edit profile form submission
async function handleEditProfileSubmit(event) {
  event.preventDefault();

  try {
    const name = document.getElementById("edit-profile-name").value.trim();
    const sitesText = document
      .getElementById("edit-profile-sites")
      .value.trim();

    if (!name || !sitesText) {
      showNotification("Please fill in all fields", "error");
      return;
    }

    const sites = sitesText
      .split("\n")
      .map((site) => site.trim())
      .filter((site) => site.length > 0)
      .map((site) => cleanWebsiteURL(site));

    if (sites.length === 0) {
      showNotification("Please enter at least one website", "error");
      return;
    }

    const profiles = (await getStorageData("profiles")) || [];
    const index = profiles.findIndex((p) => p.id === currentEditingProfile.id);

    if (index !== -1) {
      profiles[index] = {
        ...currentEditingProfile,
        name: name,
        sites: sites,
      };

      await setStorageData("profiles", profiles);
      await loadProfiles();
      closeEditModal();
      showNotification("Profile updated successfully", "success");
    } else {
      showNotification("Profile not found", "error");
    }
  } catch (error) {
    showNotification("Failed to update profile", "error");
  }
}

// Handle delete confirmation
async function handleDeleteConfirmation() {
  try {
    const profileId = document
      .getElementById("confirm-delete")
      .getAttribute("data-profile-id");

    if (!profileId) {
      showNotification("No profile selected", "error");
      return;
    }

    const profiles = (await getStorageData("profiles")) || [];
    const updatedProfiles = profiles.filter((p) => p.id !== profileId);

    await setStorageData("profiles", updatedProfiles);
    await loadProfiles();
    closeDeleteModal();
    showNotification("Profile deleted successfully", "success");
  } catch (error) {
    showNotification("Failed to delete profile", "error");
  }
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

  // Basic validation - check if it looks like a domain
  if (cleanedURL && !cleanedURL.includes(".") && !cleanedURL.includes(":")) {
    // If no dot and no port, it might be incomplete (like "facebook")
    // We could suggest adding .com, but for now just return as-is
    // The user might be entering localhost or similar
  }

  return cleanedURL;
}

// Utility functions
async function getStorageData(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      resolve(result[key]);
    });
  });
}

async function setStorageData(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 6px;
        color: white;
        font-weight: 600;
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;

  switch (type) {
    case "success":
      notification.style.backgroundColor = "#27ae60";
      break;
    case "error":
      notification.style.backgroundColor = "#e74c3c";
      break;
    case "info":
    default:
      notification.style.backgroundColor = "#3498db";
      break;
  }

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Add CSS for notifications
const style = document.createElement("style");
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 20px;
        margin-bottom: 20px;
    }
    
    .stat-item {
        text-align: center;
        padding: 20px;
        background-color: #fff;
        border-radius: 6px;
        border: 1px solid #dee2e6;
    }
    
    .stat-value {
        font-size: 24px;
        font-weight: bold;
        color: #2c3e50;
        margin-bottom: 5px;
    }
    
    .stat-label {
        font-size: 12px;
        color: #6c757d;
        text-transform: uppercase;
        letter-spacing: 1px;
    }
`;
document.head.appendChild(style);

// Functions are no longer needed globally since we use proper event listeners
