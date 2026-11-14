(() => {
	const avatar = "chatbot-avatar.svg";
	document.body.insertAdjacentHTML("beforeend", `
		<div class="pimc-chat-widget">
			<button class="pimc-chat-prompt" id="pimc-chat-prompt" type="button" aria-controls="pimc-chat-panel" aria-expanded="false">
				Hi! I’m PIMC’s AI assistant. How can I help?
			</button>
			<button class="pimc-chat-launcher" id="pimc-chat-launcher" type="button" aria-label="Open chat with PIMC’s AI assistant" aria-controls="pimc-chat-panel" aria-expanded="false">
				<img src="${avatar}" alt="">
			</button>
			<section class="pimc-chat-panel" id="pimc-chat-panel" aria-label="Chat with PIMC" aria-hidden="true" hidden>
				<header class="pimc-chat-header">
					<img src="${avatar}" alt="">
					<div class="pimc-chat-heading">
						<strong>PIMC Assistant</strong>
						<span>AI-powered chat</span>
					</div>
					<button class="pimc-chat-close" id="pimc-chat-close" type="button" aria-label="Close chat">×</button>
				</header>
				<div class="pimc-chat-log" id="pimc-chat-log" role="log" aria-live="polite" aria-relevant="additions">
					<div class="pimc-chat-message assistant">Hi! What are you hoping to achieve, or what challenge can we help with?</div>
				</div>
				<p class="pimc-chat-privacy">Messages are processed by OpenAI. Please don’t share sensitive information.</p>
				<form class="pimc-chat-controls" id="pimc-chat-form">
					<label class="pimc-visually-hidden" for="pimc-chat-input">Your message</label>
					<input id="pimc-chat-input" name="message" type="text" maxlength="1200" autocomplete="off" placeholder="Type your message…" required>
					<button class="pimc-chat-send" id="pimc-chat-send" type="submit">Send</button>
				</form>
				<p class="pimc-chat-status" id="pimc-chat-status" role="status" aria-live="polite"></p>
				<form class="pimc-chat-submit" id="pimc-enquiry-form" action="https://formsubmit.co/info@pimc.au" method="POST" hidden>
					<input type="hidden" name="_subject" value="New PIMC website enquiry">
					<input type="hidden" name="_template" value="table">
					<input type="hidden" name="name">
					<input type="hidden" name="phone">
					<input type="hidden" name="email">
					<input type="hidden" name="requirements">
					<p>By sending, you agree that PIMC may use these details to respond. Your enquiry is forwarded by FormSubmit to info@pimc.au.</p>
					<button type="submit">Send my enquiry <span aria-hidden="true">↗</span></button>
				</form>
			</section>
		</div>
	`);

	const panel = document.getElementById("pimc-chat-panel");
	const launcher = document.getElementById("pimc-chat-launcher");
	const prompt = document.getElementById("pimc-chat-prompt");
	const closeButton = document.getElementById("pimc-chat-close");
	const chatForm = document.getElementById("pimc-chat-form");
	const chatInput = document.getElementById("pimc-chat-input");
	const chatLog = document.getElementById("pimc-chat-log");
	const chatSend = document.getElementById("pimc-chat-send");
	const chatStatus = document.getElementById("pimc-chat-status");
	const enquiryForm = document.getElementById("pimc-enquiry-form");
	const messages = [];
	let contact = { name: "", phone: "", email: "", requirements: "" };
	let isOpen = false;

	function setOpen(open) {
		isOpen = open;
		panel.hidden = !open;
		panel.setAttribute("aria-hidden", String(!open));
		launcher.setAttribute("aria-expanded", String(open));
		prompt.setAttribute("aria-expanded", String(open));
		prompt.hidden = open;
		if (open) chatInput.focus();
		else launcher.focus();
	}

	function addMessage(role, text) {
		const message = document.createElement("div");
		message.className = `pimc-chat-message ${role}`;
		message.textContent = text;
		chatLog.append(message);
		chatLog.scrollTop = chatLog.scrollHeight;
		return message;
	}

	function addHistory(role, content) {
		messages.push({ role, content });
		if (messages.length > 20) messages.splice(0, messages.length - 20);
	}

	function isValidContact(details) {
		const phoneDigits = details.phone.replace(/\D/g, "");
		return details.name.trim().length > 0
			&& phoneDigits.length >= 7 && phoneDigits.length <= 15
			&& /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email)
			&& details.requirements.trim().length >= 8;
	}

	launcher.addEventListener("click", () => setOpen(!isOpen));
	prompt.addEventListener("click", () => setOpen(true));
	closeButton.addEventListener("click", () => setOpen(false));
	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && isOpen) setOpen(false);
	});

	chatForm.addEventListener("submit", async (event) => {
		event.preventDefault();
		const text = chatInput.value.trim();
		if (!text) return;

		chatInput.value = "";
		chatInput.disabled = true;
		chatSend.disabled = true;
		chatStatus.textContent = "PIMC assistant is replying…";
		const userMessage = addMessage("user", text);
		addHistory("user", text);
		enquiryForm.hidden = true;

		try {
			const response = await fetch("/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ messages })
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "The assistant couldn’t reply. Please try again.");
			if (typeof result.reply !== "string" || !result.contact) {
				throw new Error("The assistant returned an unexpected response. Please try again.");
			}

			contact = {
				name: typeof result.contact.name === "string" ? result.contact.name : "",
				phone: typeof result.contact.phone === "string" ? result.contact.phone : "",
				email: typeof result.contact.email === "string" ? result.contact.email : "",
				requirements: typeof result.contact.requirements === "string" ? result.contact.requirements : ""
			};
			addMessage("assistant", result.reply);
			addHistory("assistant", result.reply);
			const readyToSubmit = result.readyToSubmit === true;
			if (readyToSubmit && isValidContact(contact)) {
				enquiryForm.elements.namedItem("name").value = contact.name;
				enquiryForm.elements.namedItem("phone").value = contact.phone;
				enquiryForm.elements.namedItem("email").value = contact.email;
				enquiryForm.elements.namedItem("requirements").value = contact.requirements;
				enquiryForm.hidden = false;
			} else if (readyToSubmit) {
				const validationMessage = "I still need a valid name, phone number, email address, and a little detail about your requirements before I can prepare the enquiry.";
				addMessage("assistant", validationMessage);
				addHistory("assistant", validationMessage);
			}
			chatStatus.textContent = "";
		} catch (error) {
			userMessage.remove();
			messages.pop();
			chatInput.value = text;
			chatStatus.textContent = error instanceof Error ? error.message : "The assistant couldn’t reply. Please try again.";
		} finally {
			chatInput.disabled = false;
			chatSend.disabled = false;
			chatInput.focus();
		}
	});
})();
