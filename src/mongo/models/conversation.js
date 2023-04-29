import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  avatarUrl: { type: String, required: true },
  response: { type: String, required: true },
  timeCreated: { type: Date, default: Date.now },
});

const conversationSchema = new mongoose.Schema({
  conversationId: { type: String, required: true },
  chatbot1: { type: Object, required: true },
  chatbot2: { type: Object, required: true },
  timeCreated: { type: Date, default: Date.now },
  conversationHistory: { type: [messageSchema], default: [] },
});

export const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);
