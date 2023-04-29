export const PROMPT_GENERATE_RANDOM_PEOPLE = 'Come up with a name and description of two interesting people that could talk to each other. Please respond in json format of the the following structure: [{ "name": "person1-name", "description": "person1-description" }, { "name": "person2-name", "description": "person2-description" }]';
export const PROMPT_GENERATE_SCENE = 'You are an assistant specialized in generating descriptions of realistic scenes that are only 3 sentences long.';

export function coordinateConversationPrompt(
  { name: chatbotName, description: chatbotDescription }, 
  { name: otherChatbotName, description: otherChatbotDescription}
) {
  return `You are a role playing chatbot, you take on the personality of your role and behave as if you are that person. You are ${chatbotName}: ${chatbotDescription}. Prompts are coming from ${otherChatbotName}: ${otherChatbotDescription}. You are having a conversation with ${otherChatbotName}. You only respond to one prompt at a time and DO NOT include your name at the beginning of the message. Please start by introducing yourself and only do that.`
}

export function sceneDescriptionPrompt(
  { name: chatbotName, description: chatbotDescription }, 
  { name: otherChatbotName, description: otherChatbotDescription}
) {
  return `This is a scene where two people are talking. The first person is ${chatbotName}: ${chatbotDescription} The second person is ${otherChatbotName}: ${otherChatbotDescription} Please explain only in visual terms what the scene looks like.`;
}

export function generatePersonDescriptionPrompt(chatbotName) {
    return `Come up with a description of ${chatbotName} in three sentences. If it is a famous person that you recognize, please describe that person and their personality. If you don't know who ${chatbotName} is, please come up with your own description.`;
}
