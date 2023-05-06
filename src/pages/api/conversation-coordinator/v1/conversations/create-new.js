import { v4 as uuid } from 'uuid';
import { chatWithDavinci, generateImage } from '@/utils/openai-utils';
import { sceneDescriptionPrompt, PROMPT_GENERATE_RANDOM_PEOPLE } from '@/utils/prompt-utils';
import { createConversation } from '@/utils/db-helpers/conversations';
import { withRateLimit } from '@/middleware';

/**
 * @route POST api/conversation-coordinator/v1/conversations/create-new
 * @description Creates a new chatbot conversation, generates random chatbots (if requested), generates avatars (if requested), and returns a scene description.
 * 
 * @param {Object} req.body - Request body with the following structure:
 *   @param {Object} [settings] - Optional settings for conversation creation.
 *     @param {boolean} [settings.randomize=false] - If true, generate random chatbots.
 *     @param {boolean} [settings.enableAvatars=false] - If true, generate avatars for chatbots.
 *   @param {Object} chatbot1 - The first chatbot (required if randomize is false).
 *   @param {Object} chatbot2 - The second chatbot (required if randomize is false).
 *
 * @returns {Object} res.body - Response body with the following structure:
 *   @returns {string} conversationId - The unique ID of the created conversation.
 *   @returns {string} sceneDescription - The description of the scene in which the conversation takes place.
 *   @returns {Object} chatbot1 - The first chatbot in the conversation.
 *   @returns {Object} chatbot2 - The second chatbot in the conversation.
 *
 * @throws {Error} 400 - If chatbot1 and chatbot2 are not provided and randomize is false.
 * @throws {Error} 500 - If there's an error generating random people, the scene, or an error occurs while processing the request.
 * @throws {Error} 405 - If the request method is not POST.
 */
async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  try {
    let chatbot1, chatbot2;
    const settings = req.body['settings'] ?? {};

    // If randomize is true in the settings, we'll generate random people for the chatbots
    if (settings['randomize'] === true) {
      const randomPeople = JSON.parse(await chatWithDavinci(PROMPT_GENERATE_RANDOM_PEOPLE));
      if (!randomPeople) {
        return res.status(500).json({ error: 'Error generating random people' });
      }
      chatbot1 = randomPeople[0];
      chatbot2 = randomPeople[1];
    } else {
      ({ chatbot1, chatbot2 } = req.body);
    }

    if (!chatbot1 || !chatbot2) {
      return res.status(400).json({ error: 'chatbot1 and chatbot2 are required' });
    }

    // create an array of open ai generation promises which can be later ran in parellel for better performance
    const generationPromises = [];

    // generate a text description of the scene in which the conversation takes place
    generationPromises.push(chatWithDavinci(sceneDescriptionPrompt(chatbot1, chatbot2)));

    // If enableAvatars is true in the settings, we'll generate avatars for the chatbots
    if (settings['enableAvatars'] === true) {
      generationPromises.push(
        generateImage(`A portrait of ${chatbot1.name}: ${chatbot1.description}`),
        generateImage(`A portrait of ${chatbot2.name}: ${chatbot2.description}`),
      );
    }

    // run open-ai generations in parallel
    const [ sceneDescription, avatar1, avatar2 ] = await Promise.all(generationPromises);

    if (!sceneDescription) {
      return res.status(500).json({ error: 'Error generating the scene' });
    }

    chatbot1.avatarUrl = avatar1;
    chatbot2.avatarUrl = avatar2;

    const conversationId = uuid();

    // store conversation
    await createConversation(conversationId, chatbot1, chatbot2);

    // TODO: Add a way to generate a scene image

    res.status(200).json({ 
      conversationId, 
      sceneDescription, 
      chatbot1, 
      chatbot2 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while processing your request' });
  }
}

export default withRateLimit(handler, 5);
