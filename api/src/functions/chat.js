const { app } = require("@azure/functions");

const maxMessages = 20;
const maxMessageLength = 1200;
const maxConversationLength = 8000;

const response = (status, body) => ({
	status,
	headers: { "Content-Type": "application/json" },
	jsonBody: body
});

const schema = {
	name: "pimc_contact_chat",
	strict: true,
	schema: {
		type: "object",
		properties: {
			reply: { type: "string" },
			readyToSubmit: { type: "boolean" },
			contact: {
				type: "object",
				properties: {
					name: { type: "string" },
					phone: { type: "string" },
					email: { type: "string" },
					requirements: { type: "string" }
				},
				required: ["name", "phone", "email", "requirements"],
				additionalProperties: false
			}
		},
		required: ["reply", "readyToSubmit", "contact"],
		additionalProperties: false
	}
};

app.http("chat", {
	methods: ["POST"],
	authLevel: "anonymous",
	route: "chat",
	handler: async (request, context) => {
		let body;
		try {
			body = await request.json();
		} catch {
			return response(400, { error: "Please send a valid chat message." });
		}

		const messages = body?.messages;
		if (!Array.isArray(messages) || messages.length === 0 || messages.length > maxMessages
			|| messages[messages.length - 1]?.role !== "user"
			|| messages.some((message) => !message
				|| !["user", "assistant"].includes(message.role)
				|| typeof message.content !== "string"
				|| message.content.trim().length === 0
				|| message.content.length > maxMessageLength)
			|| messages.reduce((total, message) => total + (message?.content?.length || 0), 0) > maxConversationLength) {
			return response(400, { error: "That message is invalid or too long. Please try again." });
		}

		const apiKey = process.env.OPENAI_API_KEY;
		if (!apiKey) {
			return response(503, { error: "The chat assistant is not configured yet. Please email pimc@pimc.au instead." });
		}

		const systemPrompt = `You are PIMC's friendly contact assistant. PIMC provides consulting, advisory, and managed services, including agentic AI. Learn the visitor's goals or challenge in enough detail for a human consultant to follow up. Then collect their name, phone number, and email address, asking for one missing item at a time. Be concise, warm, and conversational. Do not invent or alter any contact details or requirements; carry forward details already given and use empty strings for anything not yet provided. Do not request passwords, payment information, or other sensitive information. If the visitor asks unrelated questions, briefly redirect to their business needs. Once all four fields (name, phone, email, and requirements) are present and the visitor's email and phone appear valid, summarize the requirements and contact details and ask them to confirm. Set readyToSubmit to true only after the visitor explicitly confirms the summary. If any detail is corrected or changed after confirmation, set readyToSubmit to false and ask for confirmation again. Never claim an enquiry has been sent; it is sent only after the visitor submits the form. Return only the required JSON structure.`;

		let openAIResponse;
		try {
			openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
				method: "POST",
				headers: {
					"Authorization": `Bearer ${apiKey}`,
					"Content-Type": "application/json"
				},
				signal: AbortSignal.timeout(20000),
				body: JSON.stringify({
					model: process.env.OPENAI_MODEL || "gpt-4o-mini",
					messages: [{ role: "system", content: systemPrompt }, ...messages],
					response_format: { type: "json_schema", json_schema: schema },
					max_tokens: 700
				})
			});
		} catch {
			context.error("OpenAI request failed.");
			return response(502, { error: "The assistant is temporarily unavailable. Please try again." });
		}

		if (!openAIResponse.ok) {
			context.error(`OpenAI returned status ${openAIResponse.status}.`);
			return response(502, { error: "The assistant is temporarily unavailable. Please try again." });
		}

		let result;
		try {
			const payload = await openAIResponse.json();
			result = JSON.parse(payload.choices?.[0]?.message?.content || "");
		} catch {
			context.error("OpenAI returned an invalid chat response.");
			return response(502, { error: "The assistant returned an invalid response. Please try again." });
		}

		if (typeof result.reply !== "string" || typeof result.readyToSubmit !== "boolean"
			|| !result.contact || ["name", "phone", "email", "requirements"]
				.some((field) => typeof result.contact[field] !== "string")) {
			context.error("OpenAI response did not match the chat schema.");
			return response(502, { error: "The assistant returned an invalid response. Please try again." });
		}

		return response(200, result);
	}
});
