## General Instructions for Claude Code

### Development Commands

- **Always run `npm run format`** after making any code changes. This formats the code using Prettier.
- **Always run `npm run check`** after making any code changes to ensure code has no formatting, linting or type errors. You can fix these issues after the check is run.
- **Always run `npm run build`** to build the Chrome extension for testing.

### Project-Specific Instructions

- This is a Chrome extension project for a website blocker called "Simple Site Blocker"
- The extension blocks websites for specified durations and requires solving math problems to unblock early
- Test the extension by loading it in Chrome's developer mode after building
- Never assume the extension is running - always build and reload when testing
- Focus on security and user privacy - no data should be sent to external servers

### Key Features to Implement

1. **Website Blocking**: Block specified URLs/domains for set periods
2. **Profiles**: Create and manage groups of websites to block
3. **Math Challenge**: Solve math problems to unblock sites early (3/5/7 problems based on difficulty)
4. **Distraction Notes**: Allow users to quickly jot down thoughts during blocking sessions
5. **Timer Display**: Show remaining time in real-time

### File Structure

- `manifest.json` - Extension configuration
- `background.js` - Background script handling blocking logic
- `popup.html/js` - Main UI when clicking extension icon
- `options.html/js` - Settings page for profile management
- `blocked.html` - Page shown when accessing blocked sites
- `styles.css` - Styling for all pages

### Testing Notes

- Load extension in Chrome via chrome://extensions/ in developer mode
- Test blocking by visiting blocked sites
- Test math challenges by attempting to unblock early
- Test profile creation and management
- Test distraction notes functionality

### Security Considerations

- All data stored locally using Chrome Storage API
- No external API calls or data transmission
- Validate all user inputs
- Prevent XSS in dynamically generated content
