import posthog from 'posthog-js';

// PostHog publishable API key — safe to store in code
const POSTHOG_API_KEY = 'YOUR_POSTHOG_API_KEY'; // Replace with your actual PostHog project API key
const POSTHOG_HOST = 'https://us.i.posthog.com'; // or https://eu.i.posthog.com

let initialized = false;

export function initPostHog() {
  if (initialized || POSTHOG_API_KEY === 'YOUR_POSTHOG_API_KEY') return;

  posthog.init(POSTHOG_API_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: true,
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
  });

  // Register A/B variants as person properties
  const variants = {
    landing_headline_variant: getVariant('landing_headline_variant'),
    cta_copy_variant: getVariant('cta_copy_variant'),
    try_opening_variant: getVariant('try_opening_variant'),
  };
  posthog.register(variants);

  initialized = true;
}

export function trackEvent(eventName: string, properties?: Record<string, any>) {
  if (!initialized) return;
  posthog.capture(eventName, properties);
}

export function identifyUser(userId: string, traits?: Record<string, any>) {
  if (!initialized) return;
  posthog.identify(userId, traits);
}

// A/B Feature Flags — localStorage-based, randomly assigned on first load
const FLAG_PREFIX = 'ph_';
const VARIANTS = ['A', 'B', 'C'] as const;
type Variant = typeof VARIANTS[number];

export function getVariant(flagName: string): Variant {
  const key = `${FLAG_PREFIX}${flagName}`;
  const stored = localStorage.getItem(key);
  if (stored && VARIANTS.includes(stored as Variant)) {
    return stored as Variant;
  }
  const assigned = VARIANTS[Math.floor(Math.random() * VARIANTS.length)];
  localStorage.setItem(key, assigned);
  return assigned;
}

// Buying signal keyword detection
const BUYING_KEYWORDS = [
  'pricing', 'price', 'cost', 'how much',
  'team plan', 'enterprise', 'license',
  'buy', 'purchase', 'subscribe', 'subscription',
  'demo', 'trial', 'pilot',
  'contract', 'invoice', 'payment',
];

export function detectBuyingSignal(text: string): string | null {
  const lower = text.toLowerCase();
  for (const keyword of BUYING_KEYWORDS) {
    if (lower.includes(keyword)) {
      return keyword.includes(' ') ? keyword : `${keyword}_question`;
    }
  }
  return null;
}
