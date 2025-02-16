const OpenAI = require('openai');

class AIService {
	constructor() {
		this.openai = new OpenAI({
			apiKey: process.env.OPENAI_API_KEY,
		});
	}

	async categorizeComplaint(title, description) {
		try {
			const completion = await this.openai.chat.completions.create({
				model: "gpt-3.5-turbo",
				messages: [
					{
						role: "system",
						content: `You are an AI assistant that analyzes complaints and provides structured responses.
						You should return only valid JSON in the specified format.`
					},
					{
						role: "user",
						content: `Analyze the following complaint and provide:
						1. Most appropriate category
						2. A helpful suggestion or resolution
						3. Priority level (low, medium, high)
						4. Confidence score (0-1)

						Title: ${title}
						Description: ${description}

						Format the response as JSON:
						{
							"category": "string",
							"suggestion": "string",
							"priority": "string",
							"confidence": number
						}`
					}
				]
			});

			const result = JSON.parse(completion.choices[0].message.content.trim());
			return result;
		} catch (error) {
			console.error('AI Categorization Error:', error);
			return {
				category: 'uncategorized',
				suggestion: 'Unable to generate suggestion at this time.',
				priority: 'medium',
				confidence: 0
			};
		}
	}

	async generateResponse(complaint) {
		try {
			const completion = await this.openai.chat.completions.create({
				model: "gpt-3.5-turbo",
				messages: [
					{
						role: "system",
						content: "You are a helpful customer service assistant that generates empathetic and professional responses to complaints."
					},
					{
						role: "user",
						content: `Generate a helpful response for the following complaint:
						
						Title: ${complaint.title}
						Category: ${complaint.category}
						Description: ${complaint.description}

						The response should:
						1. Be empathetic and professional
						2. Address the specific issues mentioned
						3. Provide actionable steps or solutions
						4. Include any relevant follow-up questions if needed`
					}
				]
			});

			return completion.choices[0].message.content.trim();
		} catch (error) {
			console.error('AI Response Generation Error:', error);
			return 'We apologize, but we are unable to generate a specific response at this time. A support representative will review your complaint shortly.';
		}
	}

	async analyzeSentiment(text) {
		try {
			const completion = await this.openai.chat.completions.create({
				model: "gpt-3.5-turbo",
				messages: [
					{
						role: "system",
						content: `You are an AI assistant that analyzes text sentiment and provides structured responses.
						You should return only valid JSON in the specified format.`
					},
					{
						role: "user",
						content: `Analyze the sentiment and urgency of the following text:
						"${text}"
						
						Provide the analysis as JSON:
						{
							"sentiment": "positive/negative/neutral",
							"urgency": "low/medium/high",
							"emotionalTone": "string",
							"keyEmotions": ["string"]
						}`
					}
				]
			});

			return JSON.parse(completion.choices[0].message.content.trim());
		} catch (error) {
			console.error('Sentiment Analysis Error:', error);
			return {
				sentiment: 'neutral',
				urgency: 'medium',
				emotionalTone: 'undefined',
				keyEmotions: []
			};
		}
	}

	async suggestTags(complaint) {
		try {
			const completion = await this.openai.chat.completions.create({
				model: "gpt-3.5-turbo",
				messages: [
					{
						role: "system",
						content: `You are an AI assistant that generates relevant tags for complaints.
						You should return only a JSON array of strings.`
					},
					{
						role: "user",
						content: `Generate relevant tags for the following complaint:
						
						Title: ${complaint.title}
						Category: ${complaint.category}
						Description: ${complaint.description}

						Return only an array of tags in JSON format:
						["tag1", "tag2", "tag3"]`
					}
				]
			});

			return JSON.parse(completion.choices[0].message.content.trim());
		} catch (error) {
			console.error('Tag Suggestion Error:', error);
			return [complaint.category];
		}
	}

	async summarizeComplaint(complaint) {
		try {
			const completion = await this.openai.chat.completions.create({
				model: "gpt-3.5-turbo",
				messages: [
					{
						role: "system",
						content: "You are an AI assistant that provides concise summaries of complaints."
					},
					{
						role: "user",
						content: `Provide a concise summary of the following complaint:
						
						Title: ${complaint.title}
						Category: ${complaint.category}
						Description: ${complaint.description}

						The summary should:
						1. Be no more than 2-3 sentences
						2. Highlight the main issue
						3. Include any critical details`
					}
				]
			});

			return completion.choices[0].message.content.trim();
		} catch (error) {
			console.error('Summarization Error:', error);
			return complaint.title;
		}
	}
}

module.exports = new AIService(); 