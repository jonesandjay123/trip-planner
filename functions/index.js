/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions/v2");
const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

// Set the maximum concurrent running instances
setGlobalOptions({maxInstances: 10});

exports.generateTripCards = onRequest(
    {
      secrets: ["GEMINI_API_KEY"],
      cors: true,
    },
    async (req, res) => {
      try {
        if (req.method !== "POST") {
          res.status(405).send("Method Not Allowed");
          return;
        }

        const {prompt} = req.body;

        if (!prompt) {
          res.status(400).json({error: "Missing prompt"});
          return;
        }

        const apiKey = process.env.GEMINI_API_KEY;

        const baseUrl = "https://generativelanguage.googleapis.com";
        const endpoint = "/v1/models/gemini-2.5-flash:generateContent";

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
                        text: `
You are a travel planning assistant.

Generate 5 travel candidate cards based on:

"${prompt}"

Return STRICT JSON in this format:

{
  "cards": [
    {
      "title": "",
      "subtitle": "",
      "zone": "",
      "duration": "",
      "description": "",
      "tags": []
    }
  ]
}

No markdown.
No explanation.
Only JSON.
`,
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
        data.candidates[0].content.parts[0]
        ) {
          text = data.candidates[0].content.parts[0].text;
        }

        if (!text) {
          res.status(500).json({error: "Invalid Gemini response", raw: data});
          return;
        }

        let parsed;

        try {
          parsed = JSON.parse(text);
        } catch (err) {
          res.status(500).json({
            error: "Failed to parse JSON from Gemini",
            raw: text,
          });
          return;
        }

        res.json(parsed);
      } catch (err) {
        logger.error("Error running code: ", err);
        res.status(500).json({error: "Internal error"});
      }
    },
);
