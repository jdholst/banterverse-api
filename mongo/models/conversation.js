const { Schema, model } = require('mongoose');

const conversationSchema = new Schema({
  chatbot1: Object,
  chatbot2: Object,
  conversationHistory: [
    {
      name: String,
      avatarUrl: String,
      response: String,
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Conversation = model('Conversation', conversationSchema);

module.exports = Conversation;
