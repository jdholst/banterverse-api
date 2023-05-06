import { OpenAIApi, Configuration } from 'openai';
import crypto from 'crypto';
import { Redis } from '@upstash/redis';

const openai = new OpenAIApi(new Configuration( { apiKey: process.env.OPENAI_API_KEY } ));
const redis = Redis.fromEnv();

function hashPromptKey(prompt) {
  const hash = crypto.createHash('sha256');
  hash.update(prompt);
  const hashValue = hash.digest('hex');
  const key = `chatgpt:response:${hashValue}`;
  return key;
}

export async function chatWithGPT(messages) {
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

export async function chatWithDavinci(prompt) {
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

export async function generateImage(prompt, size = "256x256") {

  if (!process.env.ENABLE_IMAGE_GENERATION) {
    return null;
  }

  try {
    const key = hashPromptKey(prompt);

    // Check if the prompt has been cached
    let image = await redis.get(key);
    if (!image) {
      const response = await openai.createImage({
        model: 'image-alpha-001', // Replace with the desired image model
        prompt: prompt,
        n: 1,
        size,
      });
  
      image = response.data.data[0].url;

      // Cache the image
      // TODO: DALLE image URLs are not stable. We should download the image from the provided URL and cache that.
      await redis.set(key, image);
    }

    return image;

    
  } catch (error) {
    console.error(error);
    return null;
  }
}
