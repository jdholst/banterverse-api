import { connectToDatabase, Conversation } from '@/mongo';
import { connectToClient } from '@/redis';
import logger from '@/logger';

const CONVERSATION_EXPIRATION = 1800; // 30 minutes

function logCacheHit(prefix, key) {
  logger.info(`${prefix}: Cache hit for ${key}!`);
}

function logCacheMiss(prefix, key) {
  logger.info(`${prefix}: Cache miss for ${key}!`);
}

export async function createConversation(conversationId, chatbot1, chatbot2) {
  await connectToDatabase();
  const conversation = new Conversation({
    conversationId,
    chatbot1,
    chatbot2,
    conversationHistory: [],
  }, null, { timestamps: true } );
  await conversation.save();

  const redisClient = await connectToClient();
  await redisClient.set(conversationId, JSON.stringify(conversation), { EX: CONVERSATION_EXPIRATION });
}

export async function getConversation(conversationId) {
  const redisClient = await connectToClient();

  let conversation = await redisClient.get(conversationId,);
  if (conversation) {
    logCacheHit('getConversation', conversationId);
    return JSON.parse(conversation);
  }

  logCacheMiss('getConversation', conversationId);

  logger.info('Fetching conversation from database...');
  await connectToDatabase();
  conversation = await Conversation.findOne({ conversationId });
  await redisClient.set(conversationId, JSON.stringify(conversation), { EX: CONVERSATION_EXPIRATION });

  return conversation;
}

export async function deleteConversation(conversationId) {
  const redisClient = await connectToClient();
  await redisClient.del(conversationId);

  await connectToDatabase();
  await Conversation.deleteOne({ conversationId });
}

export async function pushConversationHistory(conversationId, message) {
  logger.info('Updating conversation history in database...');
  await connectToDatabase();
  const updatedConversation = await Conversation.findOneAndUpdate(
    { conversationId }, 
    { $push: { conversationHistory: message } }, 
    { new: true }
  );

  logger.info('Updating conversation history in cache...');
  const redisClient = await connectToClient();
  await redisClient.set(conversationId, JSON.stringify(updatedConversation), { EX: CONVERSATION_EXPIRATION });

  return updatedConversation;
}
