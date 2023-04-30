import { withRateLimit } from '@/middleware';
import { chatWithDavinci } from '@/utils/openai-utils';
import { generatePersonDescriptionPrompt } from '@/utils/prompt-utils';
import { connectToClient } from '@/redis';

/**
 * @route POST api/conversation-coordinator/v1/utility/generate-person-description
 * @description Generates a description for the person with the given name using the Davinci chatbot.
 * This route sends a request to the chatbot with the `generatePersonDescription` function, and
 * the chatbot responds with a description for the person.
 * 
 * @param {Object} req.body - Request body containing the following structure:
 *   @param {string} name - The name of the person for whom the description is generated.
 *
 * @returns {Object} res.body - Response body containing the following structure:
 *   @returns {string} description - The generated description for the person with the given name.
 *
 * @throws {Error} 500 - An error occurred while generating the person's description.
 */
async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { name } = req.body;

    const redisClient = await connectToClient();

    let description = await redisClient.get(name);
    if (!description) {
      description = await chatWithDavinci(generatePersonDescriptionPrompt(name));
      await redisClient.set(name, description);
    }

    res.status(200).json({ description });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error generating person description' });
  }
}

export default withRateLimit(handler);
