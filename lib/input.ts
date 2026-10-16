// Checks on what the user typed, before any quota is spent on it.

export const MAX_CONCEPT_LENGTH = 200;
export const MAX_CITY_LENGTH = 100;

const HAS_WORD = /\p{L}{2,}/u;

/** A message for the user if the concept or city cannot be analysed, otherwise undefined. */
export function validateInput(concept: string, city: string): string | undefined {
  if (!concept || !city) return "Both 'concept' and 'city' are required.";
  if (concept.length > MAX_CONCEPT_LENGTH || city.length > MAX_CITY_LENGTH) {
    return `Keep the concept under ${MAX_CONCEPT_LENGTH} characters and the city under ${MAX_CITY_LENGTH}.`;
  }
  if (!HAS_WORD.test(concept)) return "Describe the dish or menu in a few words, e.g. \"izakaya-style small plates\".";
  if (!HAS_WORD.test(city)) return "Enter a city name, e.g. \"Austin, TX\".";
  return undefined;
}
