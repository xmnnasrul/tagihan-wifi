export type {
  ChatOutstandingPeriod,
  ChatArrearsCustomer,
  ChatAIConfig,
  ChatAISettings,
  ChatConversationMessage,
  ChatAIProvider,
} from './chat/providers.ts';
export {
  CHAT_AI_PROVIDERS,
  isChatAIProvider,
  getChatProviderBaseURL,
  normalizeCloudflareAccountID,
  getCloudflareWorkersAIBaseURL,
  getCloudflareAccountIDFromBaseURL,
  normalizeCloudflareWorkersAIBaseURL,
  isCloudflareWorkersAIModel,
  isCloudflareAIModel,
  parseChatArrearsCustomers,
  AI_CONFIG_STORAGE_KEY,
  DEFAULT_CHAT_AI_CONFIG,
  normalizeChatBaseURL,
  normalizeChatModel,
  normalizeChatAIConfig,
  getChatCompletionEndpoint,
  getChatStreamingEndpoint,
  isChatStreamingRejectionStatus,
  getChatModelsEndpoint,
  getChatRequestHeaders,
  getChatModelIDs,
} from './chat/providers.ts';

export type {
  ChatContextTopic,
  ChatTablePageSource,
  ChatTablePageMetadata,
  ChatWebImageMetadata,
} from './chat/metadata.ts';
export {
  isChatTablePageMetadata,
  appendChatTablePageMetadata,
  appendChatWebImageMetadata,
  getChatWebImageMetadata,
  getChatTablePageMetadata,
} from './chat/metadata.ts';

export type { ChatNewCustomerPeriod } from './chat/customer-matching.ts';
export {
  CHAT_MONTHS,
  getChatGreetingReply,
  getChatNewCustomerPeriod,
  getChatNewCustomerFollowUpQuestion,
  getChatBillingFollowUpQuestion,
  getChatContextFollowUpQuestion,
  matchesChatCustomerNameQuery,
  getChatCustomerAddressQualifierTerms,
  matchesChatCustomerAddressQuery,
  requestsChatCustomerAddress,
  getChatUnpaidMonthThreshold,
  selectChatCustomerMatchIds,
} from './chat/customer-matching.ts';

export {
  getChatNoDataReply,
  getChatBillingHistoryReply,
  getChatPackageDataReply,
  getChatNotesReply,
  getChatUnpaidBillingReply,
  getChatVisitedCustomerReply,
  getChatCustomerDataReply,
  getChatContextTopics,
  buildGroundedMessages,
} from './chat/replies.ts';

export type { ChatPendingLearning, ChatLearningAction } from './chat/learning.ts';
export {
  getChatLearningAction,
  getPendingChatLearning,
  getVisibleChatAnswer,
} from './chat/learning.ts';

export {
  getRecentChatHistory,
  buildChatRequestBody,
  addChatKnowledgeToRequestBody,
} from './chat/request.ts';

export {
  MAX_CHAT_KNOWLEDGE_SUMMARY_LENGTH,
  mergeChatKnowledgeSummary,
  selectRelevantChatKnowledge,
} from './chat/knowledge.ts';

export {
  getChatAPIErrorMessage,
  removeChatEmoji,
  getChatResponseContent,
  readChatCompletionStream,
} from './chat/response.ts';
