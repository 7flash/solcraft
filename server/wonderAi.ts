// @ts-nocheck
import { WORLD_WONDER_MAX_PARTS } from "./shared";
import { assertRealWonderRecipe } from "./wonderRecipe";

export const WONDER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "prompt", "palette", "aura", "parts"],
  properties: {
    name: { type: "string", maxLength: 42 },
    prompt: { type: "string", maxLength: 180 },
    palette: { type: "array", minItems: 1, maxItems: 8, items: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" } },
    aura: { type: "string", enum: ["none", "gold", "mint", "violet", "blue"] },
    parts: {
      type: "array",
      minItems: 12,
      maxItems: WORLD_WONDER_MAX_PARTS,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["primitive", "pos", "scale", "rot", "color", "emissive", "metalness", "roughness"],
        properties: {
          primitive: { type: "string", enum: ["box", "cylinder", "cone", "sphere", "torus", "octahedron"] },
          pos: { type: "array", minItems: 3, maxItems: 3, items: { type: "number" } },
          scale: { type: "array", minItems: 3, maxItems: 3, items: { type: "number" } },
          rot: { type: "array", minItems: 3, maxItems: 3, items: { type: "number" } },
          color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
          emissive: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
          metalness: { type: "number", minimum: 0, maximum: 1 },
          roughness: { type: "number", minimum: 0, maximum: 1 },
        },
      },
    },
  },
};

export function wonderAiProviderStatus() {
  const customUrl = String(process.env.SOLCRAFT_WONDER_AI_URL || "").trim();
  const openaiKey = String(process.env.OPENAI_API_KEY || "").trim();
  const model = String(process.env.SOLCRAFT_WONDER_OPENAI_MODEL || process.env.OPENAI_WONDER_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini").trim();
  return {
    configured: !!customUrl || !!openaiKey,
    custom: !!customUrl,
    openai: !!openaiKey,
    provider: customUrl ? "custom" : openaiKey ? "openai" : "none",
    model: openaiKey ? model : "",
  };
}


function archetypeGuidance(prompt: string) {
  const p = String(prompt || "").toLowerCase();
  if (/\b(school|schoolhouse|classroom|campus)\b/.test(p)) {
    return [
      "SCHOOL QUALITY BAR: it must be immediately recognizable as a school, not random blocks.",
      "Include a main classroom building, left/right classroom wings or campus blocks, many repeated windows, a central entrance with steps, a bell or clock tower, a flagpole/sign, and one small playground or learning prop.",
      "Use warm brick/stone body, readable roof color, light windows, and symmetrical proportions. Avoid tents, giant walls, isolated cones, or abstract cubes."
    ].join("\n");
  }
  if (/\b(skyscraper|tower|high.?rise)\b/.test(p)) {
    return "SKYSCRAPER QUALITY BAR: tall clean vertical silhouette, stacked floors, repeated window grid, distinct lobby/base, rooftop spire or antenna, no squat tents or random cubes.";
  }
  if (/\b(market|bazaar|shop|trading)\b/.test(p)) {
    return "MARKET QUALITY BAR: multiple small stalls/booths around a central counter/fountain, colorful awnings, readable paths, coin/trade accents.";
  }
  if (/\b(temple|shrine|altar)\b/.test(p)) {
    return "TEMPLE QUALITY BAR: symmetric stepped base, columns, central altar or statue, roof/spire, corner lamps/crystals, calm sacred silhouette.";
  }
  if (/\b(observatory|telescope|moon|star|astronomy)\b/.test(p)) {
    return "OBSERVATORY QUALITY BAR: round dome, telescope tube angled upward, star/moon crystals, stairs/platform, night lamps.";
  }
  if (/\b(dish|plate|bowl|meal|food|restaurant|kitchen|soup|ramen|salad)\b/.test(p)) {
    return "DISH QUALITY BAR: make a literal readable dish/plate/bowl object, not a generic building. Use a shallow plate or bowl, visible rim, food shapes, garnish/steam, spoon/chopsticks or serving props, and clean centered composition.";
  }
  if (/\b(fountain|waterfall|spring|pool)\b/.test(p)) {
    return "FOUNTAIN QUALITY BAR: make a round fountain basin, water jets, central statue/column, and clear water accents. No random towers.";
  }
  if (/\b(garden|park|grove|tree|forest)\b/.test(p)) {
    return "GARDEN QUALITY BAR: make paths, trees, benches, flowers, and a calm arranged garden footprint. No random abstract blocks.";
  }
  return "QUALITY BAR: the result must visibly match the user's noun within 2 seconds from an isometric camera. One clear subject, a clean silhouette, 3-8 unmistakable details, and no abstract clutter.";
}

export function wonderInstructions(prompt: string, kind = "building") {
  return [
    `Create a clean, simple, prompt-faithful low-poly ${kind} for a cozy multiplayer frontier game.`,
    "Return JSON only. No JavaScript, no markdown, no prose.",
    "Use only these primitives: box, cylinder, cone, sphere, torus, octahedron.",
    "The player's words are the source of truth. If they ask for a school, make a readable school; if they ask for a skyscraper, make a readable skyscraper; do not invent a generic red tent/castle.",
    archetypeGuidance(prompt),
    "Use the requested footprint and composition mode in the kind line. Single-landmark mode means one precise central object with a few support accents. District mode means several smaller related pieces spread across the footprint.",
    "Keep the model centered around x=0,z=0. Leave the plaza/foundation to the game renderer; do NOT create huge black back walls, giant slabs, massive flat bases, or permanent rings.",
    "Use 16-40 parts unless the prompt truly needs a district. Prefer one clear focal object, repeated readable details, and clean proportions over clutter. The final result must read clearly from an isometric camera.",
    "Bad output examples: random cubes/cones, giant black walls, neon debug pads, unrelated props, or piles of shapes. Good output examples: one subject with base/body/roof/detail/accent parts.",
    "Use material logic through colors, primitive choice, roughness, and repeated detail parts: brick walls, glass/window grids, roof pieces, doors/signs, columns, paths, small props. The renderer will convert these cues into deterministic procedural textures, so make surface areas intentional and not one flat blob.",
    "For every major noun in the prompt, include 3-6 unmistakable details: e.g. school = windows + entrance + bell/clock + flag/sign/playground; dish = plate/bowl + rim + food + garnish/steam + utensil; market = stalls + awnings + counters; observatory = dome + telescope; skyscraper = window grid + lobby + antenna.",
    "Coordinates are local meters. y must be >= 0. Typical height 2.0-4.2; skyscraper may reach 5.4; one optional focal spire/tower may reach 6.0. Keep most support objects below 2.0.",
    "Use the requested palette colors with readable contrast. Avoid making every part the same red/brown/dark color; at minimum use separate wall, roof, window, trim, and accent colors.",
    "Make it polished: lower body, mid detail, one focal feature, small accents. No random duplicate tents.",
    `Player prompt: ${prompt}`,
  ].join("\n");
}

async function callCustomWonderAI(prompt: string, kind = "building") {
  const url = String(process.env.SOLCRAFT_WONDER_AI_URL || "").trim();
  if (!url) return null;
  const key = String(process.env.SOLCRAFT_WONDER_AI_KEY || "").trim();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({ prompt, kind, schema: "solcraft-wonder-recipe-v1", jsonSchema: WONDER_SCHEMA, maxParts: WORLD_WONDER_MAX_PARTS, instructions: wonderInstructions(prompt, kind) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(data?.msg || data?.error?.message || `custom wonder ai ${res.status}`));
  return data?.recipe || data;
}

function firstOutputText(data: any) {
  if (typeof data?.output_text === "string") return data.output_text;
  const chunks: string[] = [];
  for (const item of data?.output || []) for (const c of item?.content || []) {
    if (typeof c?.text === "string") chunks.push(c.text);
    else if (typeof c?.output_text === "string") chunks.push(c.output_text);
  }
  return chunks.join("\n").trim();
}

async function callOpenAIWonderAI(prompt: string, kind = "building") {
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) return null;
  const model = String(process.env.SOLCRAFT_WONDER_OPENAI_MODEL || process.env.OPENAI_WONDER_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini").trim();
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: "You generate JSON mesh recipes for SolCraft buildings. Return valid JSON matching the provided schema exactly." },
        { role: "user", content: wonderInstructions(prompt, kind) },
      ],
      text: { format: { type: "json_schema", name: "solcraft_wonder_recipe", schema: WONDER_SCHEMA, strict: true } },
      temperature: 0.38,
      max_output_tokens: 9000,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(data?.error?.message || `openai ${res.status}`));
  const text = firstOutputText(data);
  if (!text) throw new Error("OpenAI returned no mesh recipe text.");
  return JSON.parse(text);
}

export async function generateWonderRecipe(prompt: string, kind = "building") {
  const status = wonderAiProviderStatus();
  const failures: string[] = [];

  if (status.custom) {
    try {
      const custom = await callCustomWonderAI(prompt, kind);
      if (custom) return { raw: custom, recipe: assertRealWonderRecipe(custom, prompt), source: "custom", fallback: false };
    } catch (e: any) {
      failures.push(`custom: ${String(e?.message || e)}`);
    }
  }

  if (status.openai) {
    try {
      const openai = await callOpenAIWonderAI(prompt, kind);
      if (openai) return { raw: openai, recipe: assertRealWonderRecipe(openai, prompt), source: "openai", fallback: false };
    } catch (e: any) {
      failures.push(`openai: ${String(e?.message || e)}`);
    }
  }

  if (!status.configured) {
    throw new Error("Real AI is not configured. Set OPENAI_API_KEY or SOLCRAFT_WONDER_AI_URL on the server and restart Next.js.");
  }
  throw new Error(`Real AI generation failed. ${failures.join(" | ") || "No provider returned a recipe."}`);
}
