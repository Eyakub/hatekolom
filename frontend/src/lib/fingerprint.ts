/**
 * Lightweight device fingerprint — canvas + screen + timezone + UA.
 * No external library needed.
 */
export function generateFingerprint(): Record<string, string | number> {
  const components: Record<string, string | number> = {};

  // Screen
  components.screenWidth = window.screen.width;
  components.screenHeight = window.screen.height;
  components.colorDepth = window.screen.colorDepth;

  // Timezone
  components.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  components.timezoneOffset = new Date().getTimezoneOffset();

  // User agent
  components.userAgent = navigator.userAgent;

  // Language
  components.language = navigator.language;

  // Canvas fingerprint
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      canvas.width = 200;
      canvas.height = 50;
      ctx.textBaseline = "top";
      ctx.font = "14px Arial";
      ctx.fillStyle = "#f60";
      ctx.fillRect(0, 0, 200, 50);
      ctx.fillStyle = "#069";
      ctx.fillText("FP-LMS-2026", 2, 15);
      components.canvas = canvas.toDataURL().slice(-50);
    }
  } catch {
    components.canvas = "unavailable";
  }

  return components;
}
