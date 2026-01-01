/**
 * Central utility for capability level labels and styling
 * Database stores: foundational, advancing, independent, mastery
 * Display shows: Level 1, Level 2, Level 3, Level 4
 */

export const CAPABILITY_LEVELS = {
  foundational: { number: 1, label: "Level 1", color: "text-blue-600 dark:text-blue-400" },
  advancing: { number: 2, label: "Level 2", color: "text-green-600 dark:text-green-400" },
  independent: { number: 3, label: "Level 3", color: "text-orange-600 dark:text-orange-400" },
  mastery: { number: 4, label: "Level 4", color: "text-purple-600 dark:text-purple-400" },
} as const;

// Map legacy/alternative values to standard values
const LEVEL_ALIASES: Record<string, keyof typeof CAPABILITY_LEVELS> = {
  beginner: "foundational",
  intermediate: "advancing",
  advanced: "independent",
  established: "independent",
  expert: "mastery",
};

/**
 * Normalize a level string to a standard value (foundational, advancing, independent, mastery)
 */
export function normalizeLevel(level: string | null | undefined): keyof typeof CAPABILITY_LEVELS {
  if (!level) return "foundational";
  const lower = level.toLowerCase();
  if (lower in CAPABILITY_LEVELS) return lower as keyof typeof CAPABILITY_LEVELS;
  if (lower in LEVEL_ALIASES) return LEVEL_ALIASES[lower];
  return "foundational";
}

/**
 * Get the display label for a capability level (e.g., "Level 1", "Level 2")
 */
export function getLevelLabel(level: string | null | undefined): string {
  const normalized = normalizeLevel(level);
  return CAPABILITY_LEVELS[normalized].label;
}

/**
 * Get the level number (1-4) for a capability level
 */
export function getLevelNumber(level: string | null | undefined): number {
  const normalized = normalizeLevel(level);
  return CAPABILITY_LEVELS[normalized].number;
}

/**
 * Get the color class for a capability level
 */
export function getLevelColor(level: string | null | undefined): string {
  const normalized = normalizeLevel(level);
  return CAPABILITY_LEVELS[normalized].color;
}

/**
 * Get the numeric score (1.0-4.0) for calculations
 */
export function getLevelScore(level: string | null | undefined): number {
  return getLevelNumber(level);
}

/**
 * Level options for dropdowns and selects
 */
export const LEVEL_OPTIONS = [
  { value: "foundational", label: "Level 1" },
  { value: "advancing", label: "Level 2" },
  { value: "independent", label: "Level 3" },
  { value: "mastery", label: "Level 4" },
] as const;

/**
 * Get background gradient style for a level
 */
export function getLevelBgGradient(level: string | null | undefined): string {
  const num = getLevelNumber(level);
  switch (num) {
    case 1: return "from-blue-500/10 to-blue-500/5";
    case 2: return "from-green-500/10 to-green-500/5";
    case 3: return "from-orange-500/10 to-orange-500/5";
    case 4: return "from-purple-500/10 to-purple-500/5";
    default: return "from-muted/10 to-muted/5";
  }
}

/**
 * Get badge variant styling for a level
 */
export function getLevelBadgeStyle(level: string | null | undefined): string {
  const num = getLevelNumber(level);
  switch (num) {
    case 1: return "bg-blue-500/10 text-blue-700 dark:text-blue-400";
    case 2: return "bg-green-500/10 text-green-700 dark:text-green-400";
    case 3: return "bg-orange-500/10 text-orange-700 dark:text-orange-400";
    case 4: return "bg-purple-500/10 text-purple-700 dark:text-purple-400";
    default: return "bg-muted";
  }
}
