var express = require('express');
var router = express.Router();
const { OpenAIApi, Configuration } = require('openai');
const openai = new OpenAIApi(new Configuration( { apiKey: process.env.OPENAI_API_KEY } ));
const { connect } = require('../mongo/db');

const { GENERATE_RANDOM_PEOPLE, coordinateConversation, GENERATE_SCENE, sceneDescription, generatePersonDescription } = require('../utils/prompt-utils');

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

    console.log(response);
    
    return response.data.choices[0].text;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function generateImage(prompt, size = "256x256") {
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

function createChatbotMessages(
  chatbot, otherChatbot,
  otherChatbotResponse,
  conversationHistory = []
) {
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

  // if (otherChatbotResponse) {
  //   prompts.push({
  //     role: 'user',
  //     content: otherChatbotResponse,
  //   });
  // }

  console.log(prompts);

  return prompts;
}

const conversationHistory = [];
let chatbotData = {
  chatbot1: null,
  chatbot2: null
}

router.get('/generate-random-people', async (req, res) => {
  try {
    const randomPeople = JSON.parse(await chatWithDavinci(GENERATE_RANDOM_PEOPLE));
    res.status(200).json({ randomPeople });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error generating random people' });
  }
});

router.post('/generate-person-description', async (req, res) => {
  try {
    const { name } = req.body;
    const description = await chatWithDavinci(generatePersonDescription(name));
    res.status(200).json({ description });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error generating random people' });
  }
});

router.post('/start-conversation', async (req, res) => {
  try {
    if (conversationHistory.length > 0) {
      conversationHistory.length = 0;
    }

    let chatbot1, chatbot2;
    if (req.query['randomize']) {
      const randomPeople = await chatWithDavinci(GENERATE_RANDOM_PEOPLE);
      if (!randomPeople) {
        return res.status(500).json({ error: 'Error generating random people' });
      }
      chatbot1 = randomPeople[0];
      chatbot2 = randomPeople[1];
    } else {
      ({ chatbot1, chatbot2 } = req.body);
    }

    if (req.query['enableAvatars']) {
      chatbot1.avatarUrl = await generateImage(`A portrait of ${chatbot1.name}: ${chatbot1.description}`);
      chatbot2.avatarUrl = await generateImage(`A portrait of ${chatbot2.name}: ${chatbot2.description}`);
    }

    chatbotData.chatbot1 = chatbot1;
    chatbotData.chatbot2 = chatbot2;

    const scene = await chatWithDavinci(sceneDescription(chatbot1, chatbot2));
    if (!scene) {
      return res.status(500).json({ error: 'Error generating the scene' });
    }

    // const sceneImage = await generateImage(scene);
    // if (!sceneImage) {
    //   return res.status(500).json({ error: 'Error generating the scene image' });
    // }

    // const chatbot1Messages = createChatbotMessages(chatbot1, chatbot2);
    // const chatbot1Response = await chatWithGPT(chatbot1Messages);

    // if (!chatbot1Response) {
    //   return res.status(500).json({ error: `Error generating a response from ${chatbot1.name}` });
    // }

    // conversationHistory.push({ name: chatbot1.name, avatarUrl: chatbot1.avatarUrl, response: chatbot1Response });
    res.status(200).json({ sceneDescription: scene, chatbot1, chatbot2 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});

router.post('/continue-conversation', async (req, res) => {
  try {
    if (!chatbotData.chatbot1 || !chatbotData.chatbot2) {
      return res.status(400).json({ error: 'No conversation is in progress. Please start a conversation before continuing.' });
    }

    let chatbotMessages, chatbotToPrompt, otherChatbot;
    if (conversationHistory.length === 0) {
      // return res.status(400).json({ error: 'No conversation is in progress. Please start a conversation before continuing.' });
      chatbotToPrompt = chatbotData.chatbot1;
      otherChatbot = chatbotData.chatbot2;
      chatbotMessages = createChatbotMessages(chatbotData.chatbot1, chatbotData.chatbot2);
    } else {
      const lastResponse = conversationHistory[conversationHistory.length - 1];

      chatbotToPrompt = chatbotData.chatbot1.name === lastResponse.name ? chatbotData.chatbot2 : chatbotData.chatbot1;
      otherChatbot = chatbotData.chatbot1.name === lastResponse.name ? chatbotData.chatbot1 : chatbotData.chatbot2;

      chatbotMessages = createChatbotMessages(chatbotToPrompt, otherChatbot, lastResponse.response, conversationHistory);
    }
    
    // Prompt the other chatbot to respond
    const chatbotResponse = await chatWithGPT(chatbotMessages);

    if (!chatbotResponse) {
      return res.status(500).json({ error: `Error generating a response from ${chatbotToPrompt.name}` });
    }

    // Add the new message to the conversation history
    conversationHistory.push({ name: chatbotToPrompt.name, avatarUrl: chatbotToPrompt.avatarUrl, response: chatbotResponse });

    res.status(200).json({ conversationHistory });

    // const dbClient = await connect();
    // const conversationCollection = dbClient.db('<dbname>').collection('conversations');

    // let ongoingConversation;
    // if (conversationHistory.length === 1) {
    //   // Create a new conversation in the database
    //   ongoingConversation = new Conversation({
    //     chatbot1: chatbotData.chatbot1,
    //     chatbot2: chatbotData.chatbot2,
    //     conversationHistory,
    //   });

    //   const result = await conversationCollection.insertOne(ongoingConversation);
    //   ongoingConversation._id = result.insertedId;
    // } else {
    //   // Update the existing conversation in the database
    //   const conversationId = conversationHistory[0]._id;
    //   await conversationCollection.updateOne(
    //     { _id: conversationId },
    //     { $push: { conversationHistory: { $each: [conversationHistory.slice(-1)[0]] } } }
    //   );

    //   ongoingConversation = await conversationCollection.findOne({ _id: conversationId });
    // }

    // res.status(200).json({ conversationHistory: ongoingConversation.conversationHistory });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});

router.get('/get-conversation', (req, res) => {
  res.json(conversationHistory);
});

router.post('/describe-and-generate-image', async (req, res) => {
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
