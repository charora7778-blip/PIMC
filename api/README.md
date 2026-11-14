# Contact chatbot API

The contact chatbot uses an Azure Functions API to call OpenAI. Configure `OPENAI_API_KEY` in the Azure Static Web App's application settings for each deployed app. Never put the key in the website files or source control. `OPENAI_MODEL` is optional and defaults to `gpt-4o-mini`. The public chat endpoint requires the key to be set before use.

The visitor's chat messages are sent to OpenAI for responses. When the visitor confirms and submits the enquiry, their name, phone number, email address, and requirements are forwarded by FormSubmit to `info@pimc.au`. Confirm the FormSubmit recipient if it has not been activated previously.
