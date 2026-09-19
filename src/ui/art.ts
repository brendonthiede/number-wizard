/** The URL of a shipped art file under the site base path; `slug` is `<kind>/<name>` with no extension. */
export const art = (slug: string): string => `${import.meta.env.BASE_URL}art/${slug}.webp`;
