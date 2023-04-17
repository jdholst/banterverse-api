var express = require('express');
var router = express.Router();

const { OpenAIApi, Configuration } = require('openai');
const openai = new OpenAIApi(new Configuration( { apiKey: process.env.OPENAI_API_KEY } ));

const { v4: uuid } = require('uuid');
const {
  GENERATE_RANDOM_PEOPLE,
  coordinateConversation,
  GENERATE_SCENE,
  sceneDescription,
  generatePersonDescription
} = require('../utils/prompt-utils');

const conversationStore = {};

// TODO: Move these openai functions to a separate file

async function chatWithGPT(messages) {
  try {
    const response = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo', // Replace with the desired GPT engine
      messages,
      max_tokens: 150,
      temperature: 0.8,
      top_p: 0.85,
      frequency_penalty: -0.2,
      presence_penalty: 0.8,
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function chatWithDavinci(prompt) {
  try {
    const response = await openai.createCompletion({
      model: "text-davinci-003",
      prompt,
      temperature: 0.7,
      max_tokens: 256,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    return response.data.choices[0].text;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function generateImage(prompt, size = "256x256") {

  if (!process.env.ENABLE_IMAGE_GENERATION) {
    return null;
  }

  try {
    const response = await openai.createImage({
      model: 'image-alpha-001', // Replace with the desired image model
      prompt: prompt,
      n: 1,
      size,
    });

    return response.data.data[0].url;
  } catch (error) {
    console.error(error);
    return null;
  }
}

function createChatbotMessages(chatbot, otherChatbot, conversationHistory = []) {
  const prompts = [
    {
      role: 'system',
      content: coordinateConversation(chatbot, otherChatbot),
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
 * @route POST /conversations/create-new
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
 */
router.post('/conversations/create-new', async (req, res) => {
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

    // store conversation in memory
    const conversationId = uuid();
    conversationStore[conversationId] = {
      chatbot1,
      chatbot2,
      timeCreated: Date.now(),
      conversationHistory: [],
    };

    // generate a text description of the scene in which the conversation takes place
    const scene = await chatWithDavinci(sceneDescription(chatbot1, chatbot2));
    if (!scene) {
      return res.status(500).json({ error: 'Error generating the scene' });
    }

    // TODO: Add a way to generate a scene image

    res.status(200).json({ 
      conversationId, 
      sceneDescription: scene, 
      chatbot1, 
      chatbot2 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});

/**
 * @route POST /conversations/:conversationId/continue
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
 */
router.post('/conversations/:conversationId/continue', async (req, res) => {
  try {
    const { conversationId } = req.params;

    if (!conversationStore[conversationId]) {
      return res.status(404).json({ error: `Conversation ${conversationId} not found.` });
    }

    const { chatbot1, chatbot2, conversationHistory } = conversationStore[conversationId];
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
    conversationHistory.push({ name: chatbotToPrompt.name, avatarUrl: chatbotToPrompt.avatarUrl, response: chatbotResponse });

    res.status(200).json({ conversationHistory });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});

/**
 * @route GET /conversations/:conversationId
 * @description Retrieves the conversation with the specified conversationId from the conversation store.
 * 
 * @param {Object} req.params - Request parameters with the following structure:
 *   @param {string} conversationId - The unique ID of the conversation to retrieve.
 *
 * @returns {Object} res.body - Response body containing the conversation object with the following structure:
 *   @returns {Object} chatbot1 - The first chatbot in the conversation.
 *   @returns {Object} chatbot2 - The second chatbot in the conversation.
 *   @returns {number} timeCreated - The timestamp of when the conversation was created.
 *   @returns {Array} conversationHistory - An array of chatbot message objects, each containing the chatbot's name, avatarUrl, and response.
 *
 * @throws {Error} 404 - If the conversation with the given conversationId is not found.
 */
router.get('/conversations/:conversationId', (req, res) => {
  const conversation = conversationStore[req.params.conversationId];
  if (!conversation) {
    return res.status(404).json({ error: `Conversation ${req.params.conversationId} not found.` });
  }

  res.json(conversationStore[req.params.conversationId]);
});

// Utility routes (TODO: Possibly move these to a different router)

router.post('/utility/generate-random-people', async (req, res) => {
  try {
    const randomPeople = JSON.parse(await chatWithDavinci(GENERATE_RANDOM_PEOPLE));
    res.status(200).json({ randomPeople });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error generating random people' });
  }
});

router.post('/utility/generate-person-description', async (req, res) => {
  try {
    const { name } = req.body;
    const description = await chatWithDavinci(generatePersonDescription(name));
    res.status(200).json({ description });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error generating random people' });
  }
});

router.post('/utility/describe-and-generate-image', async (req, res) => {
    try {
      const initialPrompt = req.body.prompt;
  
      const chatMessages = [
        { role: 'system', content: GENERATE_SCENE },
        { role: 'user', content: initialPrompt },
      ];
  
      const chatResponse = await chatWithGPT(chatMessages);
  
      if (chatResponse) {
        const imageUrl = await generateImage(initialPrompt);
  
        if (imageUrl) {
          res.json({ chatResponse, imageUrl });
        } else {
          res.status(500).json({ error: 'Error generating an image from DALL-E' });
        }
      } else {
        res.status(500).json({ error: 'Error generating a response from the ChatCompletion' });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'An error occurred while processing your request' });
    }
  });

module.exports = router;
