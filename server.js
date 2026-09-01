const http = require("http");
const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: "AQ.Ab8RN6L6yFVkYAfwC40mGcxQKuDdlFuGCdPLYSO0cWYznFYQCw"
});
const server = http.createServer(async (req, res) => {

    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // Browser preflight request
    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    res.setHeader("Content-Type", "application/json");

    if (req.method !== "POST" || req.url !== "/ask") {
        res.writeHead(404);
        res.end(JSON.stringify({
            error: "Not found"
        }));
        return;
    }

    let body = "";

    req.on("data", chunk => {
        body += chunk;
    });

    req.on("end", async () => {

        try {

            const data = JSON.parse(body);

            if (!data.message) {
                res.writeHead(400);
                res.end(JSON.stringify({
                    error: "Message is required"
                }));
                return;
            }

           const response = await ai.models.generateContent({
    model: "gemini-3.5-flash-lite",

    contents: `
You are LIFEOS, an intelligent personal life planner.

The user says:
${data.message}

Create a practical plan based on the user's request.

Return ONLY valid JSON with this exact structure:

{
  "title": "Plan title",
  "summary": "Short summary",
  "tasks": [
    {
      "title": "Task title",
      "description": "Short description",
      "priority": "HIGH",
      "date": "2026-09-01",
      "time": "16:00"
    }
  ],
  "goals": [
    {
      "title": "Goal title",
      "description": "Short description",
      "progress": 0
    }
  ]
}

Rules:
- Create 3 to 8 useful tasks.
- Create 1 to 3 goals.
- Priority must be HIGH, MEDIUM, or LOW.
- Progress must be a number from 0 to 100.
- Every task must have a date in YYYY-MM-DD format.
- Every task must have a time in HH:MM 24-hour format.
- Schedule tasks logically across the available time.
- Never schedule two tasks at the same time.
- Do not use Markdown.
- Return JSON only.
`,

    config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: "object",
            properties: {
                title: {
                    type: "string"
                },
                summary: {
                    type: "string"
                },
               tasks: {
    type: "array",

    items: {
        type: "object",

        properties: {

            title: {
                type: "string"
            },

            description: {
                type: "string"
            },

            priority: {
                type: "string",
                enum: [
                    "HIGH",
                    "MEDIUM",
                    "LOW"
                ]
            },

            date: {
                type: "string"
            },

            time: {
                type: "string"
            }

        },

        required: [
            "title",
            "description",
            "priority",
            "date",
            "time"
        ]
    }
},
                goals: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            title: {
                                type: "string"
                            },
                            description: {
                                type: "string"
                            },
                            progress: {
                                type: "number"
                            }
                        },
                        required: [
                            "title",
                            "description",
                            "progress"
                        ]
                    }
                }
            },
            required: [
                "title",
                "summary",
                "tasks",
                "goals"
            ]
        }
    }
});

            res.writeHead(200);

           const plan = JSON.parse(response.text);

res.end(JSON.stringify({
    plan: plan
}));
        } catch (error) {

            console.error("GEMINI ERROR:", error);

            res.writeHead(500);

            res.end(JSON.stringify({
                error: error.message || "AI request failed"
            }));

        }

    });

});

server.listen(3000, () => {

    console.log(
        "LIFEOS AI server running at http://localhost:3000"
    );

});