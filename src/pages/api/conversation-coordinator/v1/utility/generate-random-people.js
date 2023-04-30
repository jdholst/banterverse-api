import { withRateLimit } from '@/middleware';
import { chatWithDavinci } from '@/utils/openai-utils';
import { PROMPT_GENERATE_RANDOM_PEOPLE } from '@/utils/prompt-utils';

/**
 * @route POST api/conversation-coordinator/v1/utility/generate-random-people
 * @description Generates random people using the Davinci chatbot. This route
 * sends a request to the chatbot with the predefined `GENERATE_RANDOM_PEOPLE`
 * prompt, and the chatbot responds with a list of random people.
 *
 * @returns {Object} res.body - Response body containing the following structure:
 *   @returns {Object[]} randomPeople - An array of random people objects, each containing the person's name and description.
 *
 * @throws {Error} 500 - An error occurred while generating random people.
 */
async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const randomPeople = JSON.parse(await chatWithDavinci(PROMPT_GENERATE_RANDOM_PEOPLE));
    res.status(200).json({ randomPeople });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error generating random people' });
  }
}

export default withRateLimit(handler);
