import { findTags, findPlacesByTags, audienceDemographics, type QlooPlace, type DemographicsResult } from "./qloo";

export interface VenueCandidate {
  name: string;
  address?: string;
  phone?: string;
  rating?: number;
  priceLevel?: number | null;
  description?: string;
  website?: string;
  imageUrl?: string;
  vibeTags: string[];
  demographics?: DemographicsResult;
}

export interface RegionInsight {
  keyword: string;
  mentions: number;
}

export interface PilotPackage {
  concept: string;
  city: string;
  matchedTag?: { id: string; name: string; type: string };
  resolvedTags: { id: string; name: string; type: string }[];
  venues: VenueCandidate[];
  aggregateDemographics?: DemographicsResult;
  regionInsights: RegionInsight[];
  audienceProfile: string;
  tastingBrief: string;
  pilotPlan: string[];
  ownerLetter: string;
  limitations: string[];
}

const AGE_BUCKETS = ["24_and_younger", "25_to_29", "30_to_34", "35_to_44", "45_to_54", "55_and_older"] as const;

/** Average per-venue affinity scores into one aggregate audience profile for the hero chart. */
function aggregateDemographics(venues: VenueCandidate[]): DemographicsResult | undefined {
  const withDemo = venues.filter((v) => v.demographics);
  if (withDemo.length === 0) return undefined;

  const age: Record<string, number> = {};
  for (const bucket of AGE_BUCKETS) {
    const values = withDemo.map((v) => v.demographics?.age?.[bucket] ?? 0);
    age[bucket] = values.reduce((a, b) => a + b, 0) / values.length;
  }
  const maleValues = withDemo.map((v) => v.demographics?.gender?.male ?? 0);
  const femaleValues = withDemo.map((v) => v.demographics?.gender?.female ?? 0);
  return {
    age,
    gender: {
      male: maleValues.reduce((a, b) => a + b, 0) / maleValues.length,
      female: femaleValues.reduce((a, b) => a + b, 0) / femaleValues.length,
    },
  };
}

/**
 * Aggregate the review-derived keyword mentions Qloo attaches to each venue
 * (e.g. "brisket" mentioned 184 times) across all matched venues, as a proxy
 * for what this region's audience actually values in this niche — there is no
 * free-text review/complaint data in the API, only these aggregated counts.
 */
function aggregateRegionInsights(places: QlooPlace[]): RegionInsight[] {
  const totals = new Map<string, number>();
  for (const p of places) {
    for (const kw of p.properties?.keywords ?? []) {
      totals.set(kw.name, (totals.get(kw.name) ?? 0) + kw.count);
    }
  }
  return Array.from(totals.entries())
    .map(([keyword, mentions]) => ({ keyword, mentions }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 12);
}

function describeDemographics(demo?: DemographicsResult): string {
  if (!demo) return "Демографические данные по этому заведению недоступны.";

  const ageEntries = Object.entries(demo.age ?? {});
  const topAge = ageEntries.sort((a, b) => b[1] - a[1])[0];
  const genderLean = (demo.gender?.male ?? 0) - (demo.gender?.female ?? 0);

  const ageLabel: Record<string, string> = {
    "24_and_younger": "до 24 лет",
    "25_to_29": "25–29 лет",
    "30_to_34": "30–34 лет",
    "35_to_44": "35–44 лет",
    "45_to_54": "45–54 лет",
    "55_and_older": "55+ лет",
  };

  const genderText =
    genderLean > 0.15 ? "с заметным перекосом в мужскую аудиторию"
    : genderLean < -0.15 ? "с заметным перекосом в женскую аудиторию"
    : "со сбалансированной аудиторией по полу";

  return `Сильнее всего выражена affinity в группе ${ageLabel[topAge?.[0]] ?? "смешанной"} (score ${topAge?.[1]?.toFixed(2) ?? "н/д"}), ${genderText}.`;
}

/**
 * Rank candidate tags from broadest/most "place-matchable" to narrowest, so we can
 * try them in order against `findPlacesByTags` and stop at the first one that
 * actually returns venues. Qloo's semantic tag search often surfaces very narrow
 * compound tags (e.g. "izakaya_style_small_plates") ahead of the broad canonical
 * one ("izakaya") that places are actually tagged with.
 */
function rankTagsForPlaceMatching(
  tags: { id: string; name: string; type: string; properties?: { is_canonical?: boolean } }[]
): { id: string; name: string; type: string }[] {
  const typeWeight: Record<string, number> = {
    "urn:tag:category:place": 3,
    "urn:tag:genre:place": 3,
    "urn:tag:cuisine:qloo": 2,
    "urn:tag:genre_category:qloo": 1,
  };
  return [...tags].sort((a, b) => {
    const score = (t: (typeof tags)[number]) =>
      (typeWeight[t.type] ?? 0) * 10 + (t.properties?.is_canonical ? 5 : 0) - t.id.split("_").length;
    return score(b) - score(a);
  });
}

const STOPWORDS = new Set([
  "style", "styled", "inspired", "small", "plates", "plate", "dish", "dishes", "menu", "concept",
  "the", "a", "an", "and", "or", "with", "of", "based",
]);

/** Pull individual meaningful keywords out of a free-text concept (e.g. "izakaya-style small plates" -> ["izakaya"]). */
function extractKeywords(concept: string): string[] {
  const words = concept
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return Array.from(new Set(words));
}

export async function buildPilotPackage(concept: string, city: string): Promise<PilotPackage> {
  const limitations: string[] = [];

  const queries = [concept, ...extractKeywords(concept)];
  const tagResults = await Promise.all(queries.map((q) => findTags(q, 8).catch(() => [])));
  const candidateTags = Array.from(
    new Map(tagResults.flat().map((t) => [t.id, t])).values()
  );

  if (candidateTags.length === 0) {
    throw new Error(`Qloo не нашёл тег, похожий на "${concept}". Попробуйте переформулировать концепцию (например, конкретную кухню или тип блюда).`);
  }

  const rankedTags = rankTagsForPlaceMatching(candidateTags);
  let places: QlooPlace[] = [];
  let primaryTag = rankedTags[0];
  const triedTagNames: string[] = [];

  for (const tag of rankedTags.slice(0, 5)) {
    triedTagNames.push(tag.name);
    try {
      const found = await findPlacesByTags([tag.id], city, 8);
      if (found.length > 0) {
        // The insights API does not return these ordered by relevance to the tag,
        // so use rating as a proxy for venue quality until a sharper signal is wired in.
        places = [...found].sort((a, b) => (b.properties?.business_rating ?? 0) - (a.properties?.business_rating ?? 0));
        primaryTag = tag;
        break;
      }
    } catch {
      // try the next candidate tag
    }
  }

  if (places.length === 0) {
    limitations.push(
      `В городе "${city}" Qloo не нашёл заведений ни по одному из тегов, связанных с "${concept}" (пробовали: ${triedTagNames.join(", ")}). Возможно, город указан неточно или ниша слишком узкая для этого региона.`
    );
  }

  const topPlaces = places.slice(0, 5);
  const venues: VenueCandidate[] = await Promise.all(
    topPlaces.map(async (p) => {
      let demo: DemographicsResult | undefined;
      try {
        demo = await audienceDemographics(p.entity_id);
      } catch {
        // demographics are best-effort; omit on failure
      }
      return {
        name: p.name,
        address: p.properties?.address,
        phone: p.properties?.phone,
        rating: p.properties?.business_rating,
        priceLevel: p.properties?.price_level ?? null,
        description: p.properties?.short_description ?? p.properties?.description,
        website: p.properties?.website,
        imageUrl: p.properties?.image?.url,
        vibeTags: (p.tags ?? []).slice(0, 6).map((t) => t.name),
        demographics: demo,
      };
    })
  );

  const demoLines = venues
    .filter((v) => v.demographics)
    .map((v) => `— ${v.name}: ${describeDemographics(v.demographics)}`);

  const audienceProfile =
    demoLines.length > 0
      ? [
          `Концепция "${concept}" в городе ${city} сопоставлена с тегом Qloo "${primaryTag?.name}" (${primaryTag?.type}).`,
          `На основе аудиторий ${venues.length} близких по вкусу заведений:`,
          ...demoLines,
        ].join("\n")
      : `Недостаточно данных для построения демографического профиля аудитории по концепции "${concept}" в городе ${city}.`;

  const vibeWords = Array.from(new Set(venues.flatMap((v) => v.vibeTags))).slice(0, 10);
  const regionInsights = aggregateRegionInsights(topPlaces);

  const tastingBrief = [
    `Концепция дегустации: "${concept}"`,
    `Ориентир по атмосфере (из тегов похожих заведений): ${vibeWords.length > 0 ? vibeWords.join(", ") : "данных недостаточно"}.`,
    regionInsights.length > 0
      ? `За что реально хвалят заведения этой ниши в регионе (по частоте упоминаний в отзывах): ${regionInsights.slice(0, 6).map((r) => r.keyword).join(", ")}. Это не жалобы на конкретные блюда — Qloo не отдаёт текст отзывов, только агрегированные упоминания — но ориентир, что уже ценит местная аудитория.`
      : `Данных по упоминаниям в отзывах по этой нише в регионе недостаточно.`,
    `Формат: закрытая дегустация на 15–25 гостей, подборка 3–5 позиций меню, сбор обратной связи по карточкам оценки.`,
    `Цель: проверить product-market fit концепции до вложений в постоянное меню или открытие точки.`,
  ].join("\n");

  const pilotPlan = [
    "Неделя 1: зафиксировать финальный состав дегустационного меню (3–5 позиций) и критерии успеха пилота.",
    `Неделя 1–2: связаться с ${venues.length > 0 ? venues.slice(0, 2).map((v) => v.name).join(" и ") : "выбранной площадкой"} по поводу разового вечера/коллаборации.`,
    "Неделя 2: подготовить короткую анкету для гостей (вкус, цена, повторная покупка) и промо-сообщение для аудитории площадки.",
    "Неделя 3: провести дегустационный вечер, собрать анкеты и данные по продажам/расходу порций.",
    "Неделя 4: разбор результатов — решение идти в постоянное меню, пересобрать концепцию или сменить площадку/аудиторию.",
  ];

  const bestVenue = venues[0];
  const ownerLetter = bestVenue
    ? [
        bestVenue.phone
          ? `Прямой контакт (звонок обычно эффективнее письма — меньше риск улететь в спам): ${bestVenue.phone}`
          : `Прямой телефон не найден в данных Qloo — используйте сайт заведения.`,
        "",
        `Тема: предложение коллаборации — дегустационный вечер "${concept}"`,
        "",
        `Здравствуйте!`,
        "",
        `Мы работаем над концепцией "${concept}" и, судя по данным о вкусах аудитории, ${bestVenue.name} выглядит одной из наиболее подходящих площадок в ${city} — ваше заведение близко по атмосфере и вкусовому профилю (${bestVenue.vibeTags.slice(0, 3).join(", ") || "совпадающая ниша"}).`,
        "",
        `Предлагаем провести разовый дегустационный вечер на вашей площадке: мы берём на себя меню и подачу, вы — зал и вашу аудиторию. Для вас это дополнительный повод привлечь гостей в непиковый день без риска и вложений в новое меню.`,
        "",
        `Готовы обсудить дату и формат в удобное для вас время.`,
        "",
        `С уважением,`,
        `[Ваше имя]`,
      ].join("\n")
    : `Недостаточно данных о площадках в ${city}, чтобы подготовить письмо — уточните город или концепцию.`;

  return {
    concept,
    city,
    matchedTag: places.length > 0 ? primaryTag : undefined,
    resolvedTags: candidateTags,
    venues,
    aggregateDemographics: aggregateDemographics(venues),
    regionInsights,
    audienceProfile,
    tastingBrief,
    pilotPlan,
    ownerLetter,
    limitations,
  };
}
