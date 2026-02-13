

## Fix: Manager Onboarding Wizard Buttons Cut Off

### Problem
The Manager Onboarding Wizard dialog has `overflow-hidden` on the `DialogContent`, which prevents scrolling when the content exceeds the viewport height. On smaller screens or lower resolutions, the "Continue" and "Back" buttons are hidden below the visible area.

This is NOT a browser-specific issue -- it will happen in any browser when the screen isn't tall enough.

### Solution
Make the dialog content scrollable so buttons are always reachable:

**File: `src/components/manager-onboarding/ManagerOnboardingWizard.tsx`**
- Change `overflow-hidden` to `overflow-y-auto` on the `DialogContent`
- Add `max-h-[90vh]` to constrain the dialog height to 90% of the viewport, ensuring it never exceeds the screen

**File: `src/components/manager-onboarding/KeyActionsStep.tsx`**
- Add `pb-2` (bottom padding) to the root container so the buttons have breathing room when scrolled to the bottom

### Technical Details
- `DialogContent` class change: `"sm:max-w-md p-6 overflow-hidden"` becomes `"sm:max-w-md p-6 overflow-y-auto max-h-[90vh]"`
- The same fix benefits all three wizard steps (welcome, key-actions, first-action) since they share the same dialog container

