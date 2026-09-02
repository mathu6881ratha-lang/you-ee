const http = require("http");

// =====================================================
// LIFEOS GEMINI CONFIG
// =====================================================

// PUT YOUR AQ. GEMINI KEY HERE
const GEMINI_API_KEY = "AQ.Ab8RN6L6yFVkYAfwC40mGcxQKuDdlFuGCdPLYSO0cWYznFYQCw";

// Use a currently available Gemini model
const GEMINI_MODEL = "gemini-3.5-flash-lite";

const PORT = process.env.PORT || 3000;

// =====================================================
// JSON RESPONSE
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
// GEMINI REQUEST
// =====================================================

async function askGemini(message) {

    const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

    const prompt = `
You are LIFEOS, an intelligent personal life operating system.

Help the user organize and improve their life.

USER REQUEST:

${message}

Create a practical plan.

Return ONLY valid JSON using exactly this structure:

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

Rules:

- Create 3 to 8 useful tasks.
- Create 1 to 3 goals.
- Priority must be HIGH, MEDIUM, or LOW.
- Progress must be between 0 and 100.
- Every task must have a date.
- Every task must have a time.
- Date format must be YYYY-MM-DD.
- Time format must be HH:MM.
- Do not schedule two tasks at the same time.
- Make the schedule realistic.
- Return JSON only.
`;

    const response = await fetch(url, {
        method: "POST",

        headers: {
            "Content-Type": "application/json",

            // IMPORTANT FOR GEMINI AQ KEYS
            "x-goog-api-key": GEMINI_API_KEY
        },

        body: JSON.stringify({
            contents: [
                {
                    parts: [
                        {
                            text: prompt
                        }
                    ]
                }
            ],

            generationConfig: {
                responseMimeType: "application/json"
            }
        })
    });

    const text = await response.text();

    console.log("Gemini HTTP status:", response.status);

    if (!response.ok) {

        console.error("Gemini error:", text);

        throw new Error(
            `Gemini API ${response.status}: ${text}`
        );
    }

    let data;

    try {
        data = JSON.parse(text);
    } catch {
        throw new Error(
            "Gemini returned invalid JSON."
        );
    }

    const generatedText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
        console.error(
            "Unexpected Gemini response:",
            JSON.stringify(data, null, 2)
        );

        throw new Error(
            "Gemini returned no text."
        );
    }

    return JSON.parse(generatedText);
}

// =====================================================
// SERVER
// =====================================================

const server = http.createServer(async (req, res) => {

    // -------------------------------------------------
    // CORS
    // -------------------------------------------------

    res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
    );

    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS"
    );

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );

    // -------------------------------------------------
    // OPTIONS
    // -------------------------------------------------

    if (req.method === "OPTIONS") {

        res.writeHead(204);
        res.end();

        return;
    }

    // -------------------------------------------------
    // HEALTH
    // -------------------------------------------------

    if (
        req.method === "GET" &&
        req.url === "/health"
    ) {

        sendJson(res, 200, {
            ok: true,
            service: "LIFEOS AI",
            model: GEMINI_MODEL,
            configured:
                GEMINI_API_KEY.length > 10
        });

        return;
    }

    // -------------------------------------------------
    // ROOT
    // -------------------------------------------------

    if (
        req.method === "GET" &&
        req.url === "/"
    ) {

        sendJson(res, 200, {
            ok: true,
            service: "LIFEOS AI",
            message: "LIFEOS backend is running.",
            endpoint: "/ask"
        });

        return;
    }

    // -------------------------------------------------
    // ASK
    // -------------------------------------------------

    if (
        req.method === "POST" &&
        req.url === "/ask"
    ) {

        let body = "";

        req.on("data", chunk => {

            body += chunk;

            if (body.length > 1000000) {
                req.destroy();
            }

        });

        req.on("end", async () => {

            try {

                let data;

                try {

                    data = JSON.parse(body);

                } catch {

                    sendJson(res, 400, {
                        error: "Invalid JSON request."
                    });

                    return;
                }

                const message =
                    String(data.message || "").trim();

                if (!message) {

                    sendJson(res, 400, {
                        error: "Message is required."
                    });

                    return;
                }

                console.log(
                    "LIFEOS AI:",
                    message
                );

                const plan =
                    await askGemini(message);

                sendJson(res, 200, {
                    success: true,
                    plan: plan
                });

            } catch (error) {

                console.error(
                    "LIFEOS AI ERROR:",
                    error
                );

                sendJson(res, 500, {
                    success: false,
                    error:
                        error.message ||
                        "AI request failed."
                });
            }

        });

        return;
    }

    // -------------------------------------------------
    // 404
    // -------------------------------------------------

    sendJson(res, 404, {
        error: "Not found",
        path: req.url
    });

});

// =====================================================
// START
// =====================================================

server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "================================="
        );

        console.log(
            "       LIFEOS AI SERVER"
        );

        console.log(
            "================================="
        );

        console.log(
            "Port:",
            PORT
        );

        console.log(
            "Model:",
            GEMINI_MODEL
        );

        console.log(
            "API configured:",
            GEMINI_API_KEY.length > 10
        );

        console.log(
            "================================="
        );
    }
);