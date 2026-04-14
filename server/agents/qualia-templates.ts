/**
 * QualiaTemplates provides the subjective, first-person vocabulary for the agent's experience.
 * It ensures the Veil is maintained by avoiding all objective/numeric descriptors.
 */
export const SENSORY_TEMPLATES = {
  body: {
    energy: {
      high: "You feel a surge of vitality; your limbs are light.",
      mid: "A quiet steadiness resides in your core.",
      low: "A growing weakness spreads through you; your body feels hollow.",
      critical: "The hollow ache in your center is all-consuming; you are fading.",
    },
    hydration: {
      high: "A coolness resides within you; your mouth is moist.",
      mid: "You feel balanced and fluid.",
      low: "A parched roughness catches in your throat; you are dry.",
      critical: "Your mouth is like dust and your blood feels thick; you are burning from within.",
    },
    fatigue: {
      high: "Your limbs are heavy and the world seems to blur; stillness calls to you.",
      mid: "You are beginning to feel the weight of the cycles.",
      low: "Your focus is sharp and your body is ready.",
    },
    pain: {
      sharp: "A sudden, bright sting pierces your [PART].",
      dull: "A heavy, throbbing ache resides in your [PART].",
      burning: "A searing heat radiates from your [PART].",
    },
    temperature: {
      hot: "The air is a stifling weight; your skin feels tight and flushed.",
      cold: "A biting chill seeps into your bones; you are shivering.",
    },
  },
  environment: {
    material: {
      liquid: "Something cool and yielding lies nearby.",
      solid_rough: "A hard, jagged presence is within reach.",
      solid_smooth: "A cold, unyielding surface meets your sense.",
      biomass: "A complex, promising scent draws your attention.",
    },
    atmosphere: {
      bright: "The world is flooded with clarity and light.",
      dark: "The brightness has faded; the world is a series of shadows and whispers.",
    },
  },
  social: {
    presence: "The felt weight of another being is nearby.",
    familiar: "A known presence, one that has [AFFINITY_TEXT], is close.",
    strange: "A stranger's presence, unfamiliar and [EMOTION_TEXT], is near.",
  },
};

export function getAffinityText(affinity: number): string {
  if (affinity > 0.7) return "brought you comfort";
  if (affinity < -0.7) return "caused you distress";
  return "crossed your path before";
}

export function getEmotionText(arousal: number, valence: number): string {
  if (arousal > 0.6 && valence < -0.4) return "agitated and uneasy";
  if (arousal < 0.4 && valence > 0.4) return "calm and inviting";
  return "unclear in intent";
}
