import { connectToDatabase, Conversation } from '../../../../../mongo';

/**
 * @route GET api/conversation-coordinator/v1/conversations/:conversationId
 * @description Retrieves the conversation with the specified conversationId from the database.
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
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  const { conversationId } = req.query;

  await connectToDatabase();
  const conversation = await Conversation.findOne({ conversationId });

  if (!conversation) {
    return res.status(404).json({ error: `Conversation ${req.params.conversationId} not found.` });
  }

  res.status(200).json(conversation);
}
