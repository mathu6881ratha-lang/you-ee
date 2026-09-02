const http = require("http");
const { GoogleGenAI } = require("@google/genai");

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

if (!GEMINI_API_KEY) {
    console.error("ERROR: GEMINI_API_KEY is not set.");
}

const ai = GEMINI_API_KEY
    ? new GoogleGenAI({ apiKey: GEMINI_API_KEY })
    : null;

function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    });

    res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {

    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
        "Access-Control-Allow-Methods",
        "POST, GET, OPTIONS"
    );
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );

    // Browser preflight request
    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    // Health check
    if (req.method === "GET" && req.url === "/health") {
        sendJson(res, 200, {
            ok: true,
            service: "LIFEOS AI",
            model: GEMINI_MODEL,
            configured: Boolean(GEMINI_API_KEY)
        });
        return;
    }

    // Root page
    if (req.method === "GET" && req.url === "/") {
        sendJson(res, 200, {
            ok: true,
            service: "LIFEOS AI",
            message: "LIFEOS backend is running."
        });
        return;
    }

    // Only allow POST /ask
    if (req.method !== "POST" || req.url !== "/ask") {
        sendJson(res, 404, {
            error: "Not found"
        });
        return;
    }

    // Make sure API key exists
    if (!ai) {
        sendJson(res, 500, {
            error: "GEMINI_API_KEY is not configured on the server."
        });
        return;
    }

    let body = "";

    req.on("data", chunk => {
        body += chunk;

        // Prevent very large requests
        if (body.length > 1000000) {
            req.destroy();
        }
    });

    req.on("end", async () => {

        try {

            let data;

            try {
                data = JSON.parse(body);
            } catch (error) {
                sendJson(res, 400, {
                    error: "Invalid JSON request."
                });
                return;
            }

            const message = String(data.message || "").trim();

            if (!message) {
                sendJson(res, 400, {
                    error: "Message is required."
                });
                return;
            }

            const response = await ai.models.generateContent({

                model: GEMINI_MODEL,

                contents: `
You are LIFEOS, an intelligent personal life planner.

The user says:

${message}

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
- Schedule tasks logically.
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

            let plan;

            try {
                plan = JSON.parse(response.text);
            } catch (error) {

                sendJson(res, 500, {
                    error: "AI returned an invalid plan format."
                });

                return;
            }

            sendJson(res, 200, {
                plan: plan
            });

        } catch (error) {

            console.error("GEMINI ERROR:", error);

            sendJson(res, 500, {
                error: error.message || "AI request failed."
            });
        }
    });

    req.on("error", error => {
        console.error("REQUEST ERROR:", error);
    });

});

server.listen(PORT, "0.0.0.0", () => {

    console.log(
        `LIFEOS AI server running on port ${PORT}`
    );

});