const {setGlobalOptions} = require("firebase-functions/v2");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

setGlobalOptions({maxInstances: 10});

exports.generateTripCards = onCall(
    {
      secrets: ["GEMINI_API_KEY"],
      enforceAppCheck: true,
    },
    async (request) => {
      const {prompt} = request.data;

      if (!prompt) {
        throw new HttpsError("invalid-argument", "Missing prompt");
      }

      const apiKey = process.env.GEMINI_API_KEY;
      const baseUrl = "https://generativelanguage.googleapis.com";
      const endpoint = "/v1/models/gemini-2.5-flash:generateContent";

      try {
        const response = await fetch(
            `${baseUrl}${endpoint}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey,
              },
              body: JSON.stringify({
                contents: [
                  {
                    role: "user",
                    parts: [
                      {
                        text: `You are a travel planning assistant.

Generate travel candidate cards based on this request:
"${prompt}"

Return STRICT JSON in this format, no markdown, no explanation, only JSON:
{
  "cards": [
    {
      "title": "景點名稱",
      "subtitle": "一句話描述",
      "zone": "morning/afternoon/evening/flexible",
      "duration": "預估時間 (如 2-3hr)",
      "area": "所在區域",
      "note": "實用建議",
      "tags": ["標籤1", "標籤2"]
    }
  ]
}

Rules:
- zone must be one of: morning, afternoon, evening, flexible
- Generate 5 cards unless the user specifies a different number
- Content should be specific and practical for trip planning
- Use Traditional Chinese for all text`,
                      },
                    ],
                  },
                ],
                generationConfig: {
                  temperature: 0.7,
                  maxOutputTokens: 2048,
                },
              }),
            },
        );

        const data = await response.json();

        let text = null;
        if (
          data &&
          data.candidates &&
          data.candidates[0] &&
          data.candidates[0].content &&
          data.candidates[0].content.parts &&
          data.candidates[0].content.parts[0] &&
          data.candidates[0].content.parts[0].text
        ) {
          text = data.candidates[0].content.parts[0].text;
        }

        if (!text) {
          logger.error("Invalid Gemini response", data);
          throw new HttpsError("internal", "Invalid Gemini response");
        }

        // Clean markdown fences if present
        let cleanText = text.trim();
        if (cleanText.startsWith("```")) {
          cleanText = cleanText
              .replace(/^```(?:json)?\s*/, "")
              .replace(/```\s*$/, "");
        }

        let parsed;
        try {
          parsed = JSON.parse(cleanText);
        } catch (err) {
          logger.error("Failed to parse JSON", cleanText);
          throw new HttpsError("internal", "Failed to parse AI response");
        }

        // Validate and normalize cards
        if (!parsed.cards || !Array.isArray(parsed.cards)) {
          throw new HttpsError("internal", "Invalid cards format");
        }

        const validZones = ["morning", "afternoon", "evening", "flexible"];
        const cards = parsed.cards.map((card) => ({
          id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          title: card.title || "未命名景點",
          subtitle: card.subtitle || "",
          zone: validZones.includes(card.zone) ? card.zone : "flexible",
          duration: card.duration || "1-2hr",
          area: card.area || "",
          note: card.note || "",
          tags: Array.isArray(card.tags) ? card.tags.slice(0, 5) : [],
          comments: [],
          source: "gemini",
        }));

        return {cards};
      } catch (err) {
        if (err instanceof HttpsError) throw err;
        logger.error("Error calling Gemini:", err);
        throw new HttpsError("internal", "Failed to generate cards");
      }
    },
);
