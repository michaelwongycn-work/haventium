/**
 * Meta Pixel event tracking helpers.
 * All functions are safe to call — they check for fbq availability first.
 */

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fbq?: (...args: any[]) => void;
  }
}

function track(event: string, params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", event, params);
  }
}

/** Fire when a visitor clicks "Sign up" on the login page → signals intent */
export function trackLead() {
  track("Lead");
}

/**
 * Fire on signup form submit.
 * - price === 0  → StartTrial  (free plan)
 * - price > 0    → InitiateCheckout  (paid plan)
 *
 * @param price  The tier's monthly price (from DB), as a number
 * @param tierName  Human-readable plan name for the content_name param
 * @param currency  ISO currency code from the DB (e.g. "IDR", "USD")
 */
export function trackSignupIntent(
  price: number,
  tierName: string,
  currency: string,
) {
  if (price === 0) {
    track("StartTrial", { value: 0, currency });
  } else {
    track("InitiateCheckout", {
      value: price,
      currency,
      content_name: tierName,
    });
  }
}
