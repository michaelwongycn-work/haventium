/**
 * Meta Pixel event tracking helpers.
 * All functions are safe to call — they check for fbq availability first.
 */

type MetaPixelEvent = "Lead" | "StartTrial" | "InitiateCheckout" | "Purchase";

interface MetaPixelTrackParams {
  value?: number;
  currency?: string;
  content_name?: string;
}

declare global {
  interface Window {
    fbq?: (action: "track", event: MetaPixelEvent, params?: MetaPixelTrackParams) => void;
  }
}

function track(event: MetaPixelEvent, params?: MetaPixelTrackParams) {
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
): void {
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
