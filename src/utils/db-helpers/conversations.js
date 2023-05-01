import { connectToDatabase, Conversation } from '@/mongo';
import { Redis } from '@upstash/redis';
import logger from '@/logger';

const CONVERSATION_EXPIRATION = 1800; // 30 minutes
const redis = Redis.fromEnv();

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

  await redis.set(conversationId, conversation, { EX: CONVERSATION_EXPIRATION });
}

export async function getConversation(conversationId) {
  let conversation = await redis.get(conversationId);
  if (conversation) {
    logCacheHit('getConversation', conversationId);
    return conversation;
  }

  logCacheMiss('getConversation', conversationId);

  logger.info('Fetching conversation from database...');
  await connectToDatabase();
  conversation = await Conversation.findOne({ conversationId });
  await redis.set(conversationId, conversation, { EX: CONVERSATION_EXPIRATION });

  return conversation;
}

export async function deleteConversation(conversationId) {

  await redis.del(conversationId);

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

  await redis.set(conversationId, updatedConversation, { EX: CONVERSATION_EXPIRATION });

  return updatedConversation;
}
