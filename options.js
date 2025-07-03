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
    console.error("Failed to initialize options page:", error);
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

  // Math difficulty
  document
    .getElementById("save-difficulty")
    .addEventListener("click", saveDifficulty);

  // Distraction notes
  document
    .getElementById("clear-notes")
    .addEventListener("click", clearAllNotes);

  // Statistics
  document
    .getElementById("reset-stats")
    .addEventListener("click", resetStatistics);
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
    console.error("Failed to load profiles:", error);
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
            <button class="edit-btn" onclick="editProfile('${profile.id}')">Edit</button>
            <button class="delete-btn" onclick="deleteProfile('${profile.id}')">Delete</button>
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

// Edit profile
async function editProfile(profileId) {
  try {
    const profiles = (await getStorageData("profiles")) || [];
    const profile = profiles.find((p) => p.id === profileId);

    if (!profile) {
      showNotification("Profile not found", "error");
      return;
    }

    currentEditingProfile = profile;
    document.getElementById("profile-name").value = profile.name;
    document.getElementById("profile-sites").value = profile.sites.join("\n");
    showProfileForm(true);
  } catch (error) {
    console.error("Failed to edit profile:", error);
    showNotification("Failed to load profile for editing", "error");
  }
}

// Delete profile
async function deleteProfile(profileId) {
  if (!confirm("Are you sure you want to delete this profile?")) {
    return;
  }

  try {
    const profiles = (await getStorageData("profiles")) || [];
    const updatedProfiles = profiles.filter((p) => p.id !== profileId);

    await setStorageData("profiles", updatedProfiles);
    await loadProfiles();
    showNotification("Profile deleted successfully", "success");
  } catch (error) {
    console.error("Failed to delete profile:", error);
    showNotification("Failed to delete profile", "error");
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
      .map((site) => site.replace(/^https?:\/\//, "").replace(/^www\./, ""));

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
    console.error("Failed to save profile:", error);
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
  } catch (error) {
    console.error("Failed to load difficulty setting:", error);
  }
}

// Save difficulty setting
async function saveDifficulty() {
  try {
    const difficulty = document.querySelector(
      'input[name="difficulty"]:checked',
    ).value;
    await setStorageData("mathDifficulty", difficulty);
    showNotification("Difficulty setting saved", "success");
  } catch (error) {
    console.error("Failed to save difficulty setting:", error);
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
    console.error("Failed to load distraction notes:", error);
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

// Clear all notes
async function clearAllNotes() {
  if (!confirm("Are you sure you want to clear all distraction notes?")) {
    return;
  }

  try {
    await setStorageData("distractionNotes", []);
    await loadDistractionNotes();
    showNotification("All notes cleared", "success");
  } catch (error) {
    console.error("Failed to clear notes:", error);
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
  } catch (error) {
    console.error("Failed to load statistics:", error);
  }
}

// Reset statistics
async function resetStatistics() {
  if (!confirm("Are you sure you want to reset all statistics?")) {
    return;
  }

  try {
    // Reset statistics (placeholder for now)
    await loadStatistics();
    showNotification("Statistics reset", "success");
  } catch (error) {
    console.error("Failed to reset statistics:", error);
    showNotification("Failed to reset statistics", "error");
  }
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

// Make functions available globally for inline event handlers
window.editProfile = editProfile;
window.deleteProfile = deleteProfile;
