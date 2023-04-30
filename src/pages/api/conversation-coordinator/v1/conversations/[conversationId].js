import { getConversation, deleteConversation } from '@/utils/db-helpers/conversations';

/**
 * @route api/conversation-coordinator/v1/conversations/:conversationId
 * 
 * @method GET Retrieves the conversation with the specified conversationId from the database.
 * @method DELETE Deletes the conversation with the specified conversationId from the database.
 * 
 * @param {Object} req.query - Request parameters with the following structure:
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
  const { conversationId } = req.query;

  try {
    if (req.method === 'GET') {

      const conversation = await getConversation(conversationId);
  
      if (!conversation) {
        return res.status(404).json({ error: `Conversation ${conversationId} not found.` });
      }
  
      res.status(200).json(conversation);
    } else if (req.method === 'DELETE') {
      await deleteConversation(conversationId);
      res.status(204).end();
    } else {
      res.setHeader('Allow', ['GET', 'DELETE']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
  
}
