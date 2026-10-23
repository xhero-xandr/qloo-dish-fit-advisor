// The outreach letter to a venue owner. Pure, so the page can rewrite it for whichever venue the chef chooses.

export interface LetterVenue {
  name: string;
  phone?: string;
  vibeTags: string[];
}

export function ownerLetterFor(
  venue: LetterVenue | undefined,
  dish: string,
  city: string,
): string {
  if (!venue)
    return `Not enough venue data in ${city} to draft a letter — try a different city or concept.`;
  return [
    venue.phone
      ? `Direct contact (a call usually beats email — less risk of landing in spam): ${venue.phone}`
      : `No direct phone number found in Qloo's data — use the venue's website instead.`,
    "",
    `Subject: collaboration proposal — tasting night for "${dish}"`,
    "",
    `Hi,`,
    "",
    `We're developing a concept for "${dish}" and, based on audience taste data, ${venue.name} looks like one of the strongest-fit venues in ${city} — your place is close in atmosphere and taste profile (${venue.vibeTags.slice(0, 3).join(", ") || "a matching niche"}).`,
    "",
    `We'd like to propose a one-off tasting night at your venue: we handle the menu and service, you provide the space and your audience. For you, it's an extra draw on a slower night, with no risk or investment in a new menu.`,
    "",
    `Happy to discuss a date and format at your convenience.`,
    "",
    `Best,`,
    `[Your name]`,
  ].join("\n");
}
