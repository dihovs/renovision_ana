export const SITE_NAME = "Renovision AnA";
export const SITE_PHONE = "+1 579-999-5979";
export const SITE_PHONE_TEL = "+15799995979";
export const SITE_EMAIL = "info@renovisionana.ca";
// Where lead notifications (contact form + chat estimate tool) actually get delivered.
export const LEADS_NOTIFY_EMAIL = "artush@renovisionana.ca";
export const SITE_URL = "https://www.renovisionana.ca";
export const SITE_ADDRESS = {
  streetAddress: "68 Boulevard Cartier Ouest",
  addressLocality: "Laval",
  addressRegion: "QC",
  postalCode: "H7N 2A3",
  addressCountry: "CA",
};

export const SOCIAL_LINKS = {
  facebook: "https://www.facebook.com/nettoyageana/",
  instagram: "https://www.instagram.com/renovisionana/",
};

export const GOOGLE_REVIEWS_URL = "https://www.google.com/search?q=Renovision+AnA+Reviews";

// Below this many Google reviews, the visible UI shows the rating on its own
// ("5.0 rating on Google") instead of "5.0 based on N Google reviews" — a low
// count undersells a perfect rating. Owner's call, 2026-07-28. This affects
// display copy only: LocalBusinessSchema still publishes the true reviewCount,
// which Google requires on AggregateRating for the rich result to validate.
export const REVIEW_COUNT_DISPLAY_THRESHOLD = 50;

// Prime partner featured in the "Trusted By" logo strip.
export const GESTION_AJAX_URL = "https://gestionajax.ca/en/home/";
