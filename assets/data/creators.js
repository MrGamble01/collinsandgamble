/**
 * Brand-facing roster slots.
 *
 * Seeded only from categories the brand inquiry already lists
 * (brands.html) and the one platform the site describes for this work:
 * an Amazon storefront. Names, photos, and audience numbers are not
 * published anywhere on the site, so every record stays a placeholder.
 *
 * @typedef {Object} CreatorSlot
 * @property {string} id
 * @property {string} name
 * @property {string} niche
 * @property {readonly string[]} platforms
 * @property {string} audience
 * @property {null} photo
 * @property {true} placeholder
 * @property {string} placeholderLabel
 */

/** Categories already offered on the brand inquiry form. */
export const CREATOR_NICHES = Object.freeze([
  "Beauty",
  "Home",
  "Tech",
  "Wellness",
  "Fitness",
  "Pets",
  "Food",
  "Fashion",
  "Outdoors",
]);

const PLACEHOLDER_LABEL = "Placeholder — not a person. This site does not name creators.";
const PLACEHOLDER_AUDIENCE = "Placeholder — audience numbers are not published on the site.";

/** @type {readonly CreatorSlot[]} */
export const creators = Object.freeze(
  CREATOR_NICHES.map((niche) =>
    Object.freeze({
      id: `placeholder-${niche.toLowerCase()}`,
      name: "Placeholder",
      niche,
      platforms: Object.freeze(["Amazon storefront"]),
      audience: PLACEHOLDER_AUDIENCE,
      photo: null,
      placeholder: true,
      placeholderLabel: PLACEHOLDER_LABEL,
    }),
  ),
);
