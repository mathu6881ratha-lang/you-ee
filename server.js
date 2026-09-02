const http = require("http");
const { GoogleGenAI } = require("@google/genai");

// =====================================================
// PUT YOUR GEMINI API KEY HERE
// =====================================================

const GEMINI_API_KEY = "AQ.Ab8RN6L6yFVkYAfwC40mGcxQKuDdlFuGCdPLYSO0cWYznFYQCw";

const GEMINI_MODEL = "gemini-3.5-flash-lite";
const PORT = process.env.PORT || 3000;

// =====================================================
// GEMINI CLIENT
// =====================================================

const ai = new GoogleGenAI({
    apiKey: GEMINI_API_KEY
});

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
// SERVER
// =====================================================

const server = http.createServer(async (req, res) => {

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS"
    );
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );

    // CORS preflight
    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    // =================================================
    // HEALTH
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
    // ROOT
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
    // AI
    // =================================================

    if (req.method === "POST" && req.url === "/ask") {

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

                const message = String(
                    data.message || ""
                ).trim();

                if (!message) {
                    sendJson(res, 400, {
                        error: "Message is required."
                    });
                    return;
                }

                console.log("LIFEOS REQUEST:", message);

                // =========================================
                // GEMINI REQUEST
                // =========================================

                const response = await ai.models.generateContent({

                    model: GEMINI_MODEL,

                    contents: `
You are LIFEOS, an intelligent personal life operating system.

Help the user organize their life.

USER REQUEST:

${message}

Create a practical plan.

Return ONLY JSON using this structure:

{
  "title": "Plan title",
  "summary": "Short summary",
  "tasks": [
    {
      "title": "Task title",
      "description": "Task description",
      "priority": "HIGH",
      "date": "2026-09-02",
      "time": "16:00"
    }
  ],
  "goals": [
    {
      "title": "Goal title",
      "description": "Goal description",
      "progress": 0
    }
  ]
}

Rules:

- Create 3 to 8 tasks.
- Create 1 to 3 goals.
- Priority must be HIGH, MEDIUM, or LOW.
- Progress must be 0-100.
- Every task needs a date.
- Every task needs a time.
- Dates must use YYYY-MM-DD.
- Times must use HH:MM.
- Do not schedule two tasks at the same time.
- Make the plan realistic.
- Return JSON only.
`,

                    config: {
                        responseMimeType: "application/json"
                    }

                });

                let plan;

                try {
                    plan = JSON.parse(response.text);
                } catch (error) {

                    console.error(
                        "Gemini returned:",
                        response.text
                    );

                    sendJson(res, 500, {
                        error: "Gemini returned invalid JSON."
                    });

                    return;
                }

                sendJson(res, 200, {
                    success: true,
                    plan: plan
                });

            } catch (error) {

                console.error(
                    "GEMINI ERROR:",
                    error
                );

                sendJson(res, 500, {
                    success: false,
                    error: error.message || "Gemini request failed."
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
// START
// =====================================================

server.listen(PORT, "0.0.0.0", () => {

    console.log("=================================");
    console.log("       LIFEOS AI SERVER");
    console.log("=================================");
    console.log("Port:", PORT);
    console.log("Model:", GEMINI_MODEL);
    console.log("API configured:", GEMINI_API_KEY.length > 10);
    console.log("=================================");

});