const http = require("http");
const { GoogleGenAI } = require("@google/genai");

// =====================================================
// LIFEOS CONFIGURATION
// =====================================================

// PUT YOUR NEW GEMINI API KEY BETWEEN THE QUOTES
const GEMINI_API_KEY = "AQ.Ab8RN6L6yFVkYAfwC40mGcxQKuDdlFuGCdPLYSO0cWYznFYQCw";

// Gemini model
const GEMINI_MODEL = "gemini-3.5-flash-lite";

const PORT = process.env.PORT || 3000;

// =====================================================
// GEMINI
// =====================================================

const ai = new GoogleGenAI({
    apiKey: GEMINI_API_KEY
});

// =====================================================
// HELPERS
// =====================================================

function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    });

    res.end(JSON.stringify(data));
}

// =====================================================
// SERVER
// =====================================================

const server = http.createServer(async (req, res) => {

    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS"
    );
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );

    // OPTIONS request
    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    // =================================================
    // HEALTH CHECK
    // =================================================

    if (req.method === "GET" && req.url === "/health") {
        sendJson(res, 200, {
            ok: true,
            service: "LIFEOS AI",
            model: GEMINI_MODEL,
            configured: GEMINI_API_KEY.length > 10
        });

        return;
    }

    // =================================================
    // HOME
    // =================================================

    if (req.method === "GET" && req.url === "/") {
        sendJson(res, 200, {
            ok: true,
            service: "LIFEOS AI",
            message: "LIFEOS backend is running.",
            endpoint: "/ask"
        });

        return;
    }

    // =================================================
    // AI ENDPOINT
    // =================================================

    if (req.method === "POST" && req.url === "/ask") {

        let body = "";

        req.on("data", chunk => {
            body += chunk;

            // Prevent huge requests
            if (body.length > 1000000) {
                req.destroy();
            }
        });

        req.on("end", async () => {

            try {

                // -----------------------------------------
                // Parse request
                // -----------------------------------------

                let data;

                try {
                    data = JSON.parse(body);
                } catch (error) {

                    sendJson(res, 400, {
                        error: "Invalid JSON request."
                    });

                    return;
                }

                // -----------------------------------------
                // Get message
                // -----------------------------------------

                const message = String(
                    data.message || ""
                ).trim();

                if (!message) {

                    sendJson(res, 400, {
                        error: "Message is required."
                    });

                    return;
                }

                console.log("LIFEOS AI REQUEST:");
                console.log(message);

                // -----------------------------------------
                // Ask Gemini
                // -----------------------------------------

                const response = await ai.models.generateContent({

                    model: GEMINI_MODEL,

                    contents: `
You are LIFEOS, an intelligent personal life operating system.

Your job is to help the user organize their life.

The user says:

${message}

Create a practical, realistic plan.

Return ONLY valid JSON.

Use this exact structure:

{
    "title": "Plan title",
    "summary": "Short useful summary",
    "tasks": [
        {
            "title": "Task title",
            "description": "Short description",
            "priority": "HIGH",
            "date": "2026-09-02",
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

RULES:

1. Create 3 to 8 useful tasks.
2. Create 1 to 3 goals.
3. Priority must be HIGH, MEDIUM, or LOW.
4. Progress must be between 0 and 100.
5. Every task needs a date.
6. Every task needs a time.
7. Use YYYY-MM-DD for dates.
8. Use 24-hour HH:MM for times.
9. Do not schedule two tasks at the same time.
10. Make the schedule realistic.
11. Do not use Markdown.
12. Return JSON only.
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

                // -----------------------------------------
                // Parse Gemini response
                // -----------------------------------------

                let plan;

                try {

                    plan = JSON.parse(response.text);

                } catch (error) {

                    console.error(
                        "INVALID GEMINI RESPONSE:",
                        response.text
                    );

                    sendJson(res, 500, {
                        error: "Gemini returned invalid JSON."
                    });

                    return;
                }

                // -----------------------------------------
                // Send result to LIFEOS
                // -----------------------------------------

                sendJson(res, 200, {
                    success: true,
                    plan: plan
                });

                console.log("LIFEOS AI RESPONSE SENT.");

            } catch (error) {

                console.error(
                    "GEMINI ERROR:",
                    error
                );

                sendJson(res, 500, {
                    success: false,
                    error:
                        error.message ||
                        "Gemini request failed."
                });
            }

        });

        return;
    }

    // =================================================
    // 404
    // =================================================

    sendJson(res, 404, {
        error: "Not found",
        path: req.url
    });

});

// =====================================================
// START SERVER
// =====================================================

server.listen(PORT, "0.0.0.0", () => {

    console.log("");
    console.log("=================================");
    console.log("       LIFEOS AI SERVER");
    console.log("=================================");
    console.log("Server running on port:", PORT);
    console.log("Gemini model:", GEMINI_MODEL);
    console.log("Gemini API configured:", GEMINI_API_KEY.length > 10);
    console.log("AI endpoint: /ask");
    console.log("Health endpoint: /health");
    console.log("=================================");
    console.log("");

});