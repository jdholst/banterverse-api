import { connectToDatabase, Conversation } from '../../../../../../mongo';
import { chatWithGPT } from '../../../../../../utils/openai-utils';
import { coordinateConversationPrompt } from '../../../../../../utils/prompt-utils';

function createChatbotMessages(chatbot, otherChatbot, conversationHistory = []) {
  const prompts = [
    {
      role: 'system',
      content: coordinateConversationPrompt(chatbot, otherChatbot),
    },
  ].concat(
    conversationHistory.map(({ name, response }) => ({
      role: name === otherChatbot.name ? 'user' : 'assistant',
      content: response,
    }))
  );

  return prompts;
}

/**
 * @route POST api/conversation-coordinator/v1/conversations/:conversationId/continue
 * @description Continues a chatbot conversation, prompting the next chatbot to respond, and updates the conversation history.
 * 
 * @param {Object} req.params - Request parameters with the following structure:
 *   @param {string} conversationId - The unique ID of the conversation to continue.
 *
 * @returns {Object} res.body - Response body with the following structure:
 *   @returns {Array} conversationHistory - An array of chatbot message objects, each containing the chatbot's name, avatarUrl, and response.
 *
 * @throws {Error} 404 - If the conversation with the given conversationId is not found.
 * @throws {Error} 500 - If there's an error generating a response from the chatbot or an error occurs while processing the request.
 * @throws {Error} 405 - If the request method is not POST.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  try {
    const { conversationId } = req.query;

    await connectToDatabase();
    const conversation = await Conversation.findOne({ conversationId });

    if (!conversation) {
      return res.status(404).json({ error: `Conversation ${conversationId} not found.` });
    }

    const { chatbot1, chatbot2, conversationHistory } = conversation;
    let chatbotMessages, chatbotToPrompt, otherChatbot;

    if (conversationHistory.length === 0) {
      // conversation has not started, so we'll prompt the first chatbot to respond
      chatbotToPrompt = chatbot1;
      otherChatbot = chatbot2;
      chatbotMessages = createChatbotMessages(chatbot1, chatbot2);
    } else {
      // conversation has started, so we'll prompt the other chatbot with the last response
      const lastResponse = conversationHistory[conversationHistory.length - 1];

      chatbotToPrompt = chatbot1.name === lastResponse.name ? chatbot2 : chatbot1;
      otherChatbot = chatbot1.name === lastResponse.name ? chatbot1 : chatbot2;

      chatbotMessages = createChatbotMessages(chatbotToPrompt, otherChatbot, conversationHistory);
    }
    
    // Prompt the other chatbot to respond
    const chatbotResponse = await chatWithGPT(chatbotMessages);

    if (!chatbotResponse) {
      return res.status(500).json({ error: `Error generating a response from ${chatbotToPrompt.name}` });
    }

    // Add the new message to the conversation history
    const newMessage = {
      name: chatbotToPrompt.name,
      avatarUrl: chatbotToPrompt.avatarUrl,
      response: chatbotResponse,
    };

    await Conversation.updateOne({ conversationId }, { $push: { conversationHistory: newMessage } });

    res.status(200).json({ conversationHistory: [...conversationHistory, newMessage] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while processing your request' });
  }
}