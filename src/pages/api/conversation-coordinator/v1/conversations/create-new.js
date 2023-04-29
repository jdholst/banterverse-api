import { v4 as uuid } from 'uuid';
import { chatWithDavinci, generateImage } from '../../../../../utils/openai-utils';
import { sceneDescriptionPrompt } from '../../../../../utils/prompt-utils';
import { connectToDatabase, Conversation } from '../../../../../mongo';

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
export default async function handler(req, res) {
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
      const randomPeople = JSON.parse(await chatWithDavinci(GENERATE_RANDOM_PEOPLE));
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

    // If enableAvatars is true in the settings, we'll generate avatars for the chatbots
    if (settings['enableAvatars'] === true) {
      chatbot1.avatarUrl = await generateImage(`A portrait of ${chatbot1.name}: ${chatbot1.description}`);
      chatbot2.avatarUrl = await generateImage(`A portrait of ${chatbot2.name}: ${chatbot2.description}`);
    }

    // store conversation in MongoDB
    await connectToDatabase();
    const conversationId = uuid();
    const newConversation = new Conversation({
      conversationId,
      chatbot1,
      chatbot2,
      conversationHistory: [],
    });
    await newConversation.save();

    // generate a text description of the scene in which the conversation takes place
    const sceneDescription = await chatWithDavinci(sceneDescriptionPrompt(chatbot1, chatbot2));
    if (!sceneDescription) {
      return res.status(500).json({ error: 'Error generating the scene' });
    }

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
