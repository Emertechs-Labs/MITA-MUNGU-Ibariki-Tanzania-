const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Import services (will be injected by main server)
let encryptionService;
let consensusService;
let singularityNET;
let mettaRuntime;
let hyperonProcessor;

// Initialize services function (called from main server)
const initializeServices = (services) => {
  encryptionService = services.encryptionService;
  consensusService = services.consensusService;
  singularityNET = services.singularityNET;
  mettaRuntime = services.mettaRuntime;
  hyperonProcessor = services.hyperonProcessor;
};

// Knowledge Base Management Routes

// Ingest document into knowledge base
router.post('/documents', authenticateToken, authorizeRoles(['admin', 'moderator']), asyncHandler(async (req, res) => {
  const { title, content, category, tags, language, source, metadata } = req.body;
  const authorId = req.user.id;

  // Validate required fields
  if (!title || !content) {
    return res.status(400).json({
      error: 'Document title and content are required'
    });
  }

  // AI-powered content analysis and categorization
  const analysis = await singularityNET.executeWorkflow({
    type: 'document-analysis',
    data: {
      title,
      content,
      language: language || 'sw'
    },
    context: { task: 'ingestion' }
  });

  // Extract entities and relationships for knowledge graph
  const entities = await extractEntities(content, language);
  const relationships = await extractRelationships(content, entities);

  // Create knowledge document
  const document = {
    documentId: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title,
    content,
    summary: analysis.summary || content.substring(0, 200) + '...',
    category: category || analysis.category || 'general',
    tags: tags || analysis.tags || [],
    language: language || 'sw',
    source: source || 'user-contributed',
    authorId,
    entities,
    relationships,
    metadata: metadata || {},
    aiAnalysis: analysis.result,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'active',
    version: 1
  };

  // Store document in consensus for immutability
  const consensusResult = await consensusService.submitMessage({
    type: 'knowledge-document',
    document: encryptionService.encryptVote(JSON.stringify(document), authorId)
  });

  // Update knowledge graph
  await updateKnowledgeGraph(document);

  res.status(201).json({
    message: 'Document ingested successfully',
    document: {
      ...document,
      consensusTransactionId: consensusResult.transactionId,
      entityCount: entities.length,
      relationshipCount: relationships.length
    }
  });
}));

// Get documents with filtering and search
router.get('/documents', authenticateToken, asyncHandler(async (req, res) => {
  const {
    query,
    category,
    tags,
    language,
    authorId,
    source,
    sortBy = 'recent',
    page = 1,
    limit = 20
  } = req.query;

  // Build search criteria
  const searchCriteria = {};
  if (query) searchCriteria.query = query;
  if (category) searchCriteria.category = category;
  if (tags) searchCriteria.tags = tags.split(',');
  if (language) searchCriteria.language = language;
  if (authorId) searchCriteria.authorId = authorId;
  if (source) searchCriteria.source = source;

  // AI-powered semantic search
  const searchResults = await singularityNET.executeWorkflow({
    type: 'semantic-search',
    data: searchCriteria,
    context: { searchType: 'documents', userId: req.user.id }
  });

  // Simulate fetching documents
  const documents = await searchDocuments(searchCriteria, sortBy, page, limit, searchResults);

  res.json({
    documents,
    searchResults: searchResults.metadata || {},
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: documents.length * 5, // Simulated total
      hasMore: documents.length === limit
    }
  });
}));

// Get specific document
router.get('/documents/:documentId', authenticateToken, asyncHandler(async (req, res) => {
  const { documentId } = req.params;

  const document = await getDocument(documentId);

  if (!document) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Get related documents and entities
  const related = await getRelatedDocuments(documentId);
  const graphContext = await getGraphContext(document.entities);

  res.json({
    document,
    related,
    graphContext
  });
}));

// Update document
router.put('/documents/:documentId', authenticateToken, asyncHandler(async (req, res) => {
  const { documentId } = req.params;
  const { title, content, category, tags, metadata } = req.body;
  const userId = req.user.id;

  const document = await getDocument(documentId);

  if (!document) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Check permissions (author or admin)
  if (document.authorId !== userId && !req.user.roles.includes('admin')) {
    return res.status(403).json({ error: 'Permission denied' });
  }

  // Re-analyze updated content
  const analysis = await singularityNET.executeWorkflow({
    type: 'document-analysis',
    data: {
      title: title || document.title,
      content: content || document.content
    },
    context: { task: 'update' }
  });

  const updatedDocument = {
    ...document,
    title: title || document.title,
    content: content || document.content,
    summary: analysis.summary || document.summary,
    category: category || document.category,
    tags: tags || document.tags,
    metadata: { ...document.metadata, ...metadata },
    aiAnalysis: analysis.result,
    updatedAt: new Date().toISOString(),
    version: document.version + 1
  };

  // Update knowledge graph
  await updateKnowledgeGraph(updatedDocument);

  res.json({
    message: 'Document updated successfully',
    document: updatedDocument
  });
}));

// Delete document
router.delete('/documents/:documentId', authenticateToken, authorizeRoles(['admin']), asyncHandler(async (req, res) => {
  const { documentId } = req.params;

  const document = await getDocument(documentId);

  if (!document) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Mark as deleted and remove from knowledge graph
  document.status = 'deleted';
  document.deletedAt = new Date().toISOString();

  await removeFromKnowledgeGraph(documentId);

  res.json({
    message: 'Document deleted successfully'
  });
}));

// Knowledge Query and Reasoning Routes

// Query knowledge base with natural language
router.post('/query', authenticateToken, asyncHandler(async (req, res) => {
  const { query, language, context, reasoningType = 'rag' } = req.body;
  const userId = req.user.id;

  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  // Multi-step reasoning process
  const startTime = Date.now();

  // 1. Semantic search for relevant documents
  const searchResults = await singularityNET.executeWorkflow({
    type: 'semantic-search',
    data: { query, language: language || 'sw' },
    context: { searchType: 'query', userId }
  });

  // 2. Retrieve relevant context
  const contextDocuments = await getContextDocuments(searchResults.results || []);

  // 3. Apply reasoning based on type
  let reasoningResult;
  switch (reasoningType) {
    case 'metta':
      reasoningResult = await mettaRuntime.reason(`(answer-question "${query}" ${JSON.stringify(contextDocuments)})`);
      break;
    case 'hyperon':
      reasoningResult = await hyperonProcessor.processDecision(
        { type: 'knowledge-query', query, context: contextDocuments },
        ['answer', 'clarify', 'escalate']
      );
      break;
    case 'rag':
    default:
      reasoningResult = await singularityNET.executeWorkflow({
        type: 'rag-query',
        data: {
          query,
          context: contextDocuments,
          language: language || 'sw'
        },
        context: { userId, reasoningType: 'comprehensive' }
      });
      break;
  }

  // 4. Generate final answer
  const finalAnswer = await generateAnswer(query, reasoningResult, contextDocuments);

  const processingTime = Date.now() - startTime;

  res.json({
    query,
    answer: finalAnswer,
    reasoning: {
      type: reasoningType,
      confidence: reasoningResult.confidence || 0.8,
      sources: contextDocuments.length,
      processingTime
    },
    sources: contextDocuments.map(doc => ({
      documentId: doc.documentId,
      title: doc.title,
      relevance: doc.relevance || 0.8
    })),
    followUpQuestions: generateFollowUpQuestions(query, finalAnswer)
  });
}));

// Advanced reasoning endpoint
router.post('/reason', authenticateToken, authorizeRoles(['admin', 'researcher']), asyncHandler(async (req, res) => {
  const { premises, conclusion, reasoningType = 'deductive' } = req.body;

  if (!premises || !Array.isArray(premises)) {
    return res.status(400).json({ error: 'Premises array is required' });
  }

  // Use MeTTa for advanced reasoning
  const reasoningQuery = `(reason-about ${JSON.stringify(premises)} "${conclusion || 'unknown'}" ${reasoningType})`;
  const result = await mettaRuntime.reason(reasoningQuery);

  // Validate reasoning with Hyperon
  const validation = await hyperonProcessor.processDecision(
    { type: 'reasoning-validation', premises, conclusion, result },
    ['valid', 'invalid', 'uncertain']
  );

  res.json({
    reasoning: {
      premises,
      conclusion: conclusion || result.conclusion,
      type: reasoningType,
      result: result,
      validation: validation.decision,
      confidence: validation.confidence
    }
  });
}));

// Knowledge Graph Exploration Routes

// Get knowledge graph nodes and relationships
router.get('/graph', authenticateToken, asyncHandler(async (req, res) => {
  const { entityId, relationshipType, depth = 2, limit = 50 } = req.query;

  const graph = await exploreKnowledgeGraph(entityId, relationshipType, depth, limit);

  res.json({
    graph,
    metadata: {
      nodeCount: graph.nodes?.length || 0,
      relationshipCount: graph.relationships?.length || 0,
      depth: parseInt(depth),
      limit: parseInt(limit)
    }
  });
}));

// Get entity details
router.get('/entities/:entityId', authenticateToken, asyncHandler(async (req, res) => {
  const { entityId } = req.params;

  const entity = await getEntity(entityId);

  if (!entity) {
    return res.status(404).json({ error: 'Entity not found' });
  }

  const relatedEntities = await getRelatedEntities(entityId);
  const documents = await getEntityDocuments(entityId);

  res.json({
    entity,
    relatedEntities,
    documents,
    graphContext: await getEntityGraphContext(entityId)
  });
}));

// Create custom entity
router.post('/entities', authenticateToken, authorizeRoles(['admin', 'researcher']), asyncHandler(async (req, res) => {
  const { name, type, description, properties, language } = req.body;
  const creatorId = req.user.id;

  if (!name || !type) {
    return res.status(400).json({
      error: 'Entity name and type are required'
    });
  }

  const entity = {
    entityId: `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    type,
    description,
    properties: properties || {},
    language: language || 'sw',
    creatorId,
    createdAt: new Date().toISOString(),
    confidence: 0.8, // AI-extracted entities have higher confidence
    source: 'manual'
  };

  await addEntityToGraph(entity);

  res.status(201).json({
    message: 'Entity created successfully',
    entity
  });
}));

// Learning and Adaptation Routes

// Submit feedback on knowledge answer
router.post('/feedback', authenticateToken, asyncHandler(async (req, res) => {
  const { queryId, rating, feedback, correction } = req.body;
  const userId = req.user.id;

  // Store feedback for learning
  const feedbackRecord = {
    feedbackId: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    queryId,
    userId,
    rating: rating || 5, // 1-5 scale
    feedback,
    correction,
    timestamp: new Date().toISOString()
  };

  // Use feedback for MeTTa learning
  if (correction) {
    await mettaRuntime.learn({
      type: 'correction',
      originalQuery: queryId,
      correction,
      userId,
      timestamp: new Date().toISOString()
    });
  }

  res.json({
    message: 'Feedback submitted successfully',
    feedbackId: feedbackRecord.feedbackId
  });
}));

// Get knowledge statistics
router.get('/stats', authenticateToken, authorizeRoles(['admin']), asyncHandler(async (req, res) => {
  const stats = await getKnowledgeStats();

  res.json({
    stats,
    aiMetrics: {
      metta: mettaRuntime.getStats(),
      hyperon: hyperonProcessor.getStats(),
      singularityNET: await getSingularityNETStats()
    }
  });
}));

// Multi-language Support Routes

// Translate knowledge content
router.post('/translate', authenticateToken, asyncHandler(async (req, res) => {
  const { text, fromLanguage, toLanguage, context } = req.body;

  if (!text || !toLanguage) {
    return res.status(400).json({
      error: 'Text and target language are required'
    });
  }

  const translation = await singularityNET.executeWorkflow({
    type: 'translation',
    data: {
      text,
      fromLanguage: fromLanguage || 'auto',
      toLanguage,
      context: context || 'knowledge'
    },
    context: { preserveMeaning: true }
  });

  res.json({
    originalText: text,
    translatedText: translation.result,
    fromLanguage: translation.fromLanguage,
    toLanguage,
    confidence: translation.confidence || 0.9
  });
}));

// Get supported languages
router.get('/languages', asyncHandler(async (req, res) => {
  res.json({
    languages: [
      { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili' },
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'fr', name: 'French', nativeName: 'Français' },
      { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
      { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
      { code: 'zh', name: 'Chinese', nativeName: '中文' }
    ],
    defaultLanguage: 'sw'
  });
}));

// Helper functions (implement with actual database/storage)
async function extractEntities(content, language) {
  // Mock entity extraction - in production, use NLP models
  const entities = [];
  const words = content.toLowerCase().split(/\s+/);

  // Simple entity recognition
  const entityTypes = {
    person: ['president', 'minister', 'leader', 'person'],
    organization: ['government', 'ministry', 'company', 'organization'],
    location: ['tanzania', 'dar es salaam', 'africa', 'country'],
    concept: ['democracy', 'development', 'education', 'health']
  };

  Object.entries(entityTypes).forEach(([type, keywords]) => {
    keywords.forEach(keyword => {
      if (words.includes(keyword)) {
        entities.push({
          id: `entity_${type}_${keyword}_${Date.now()}`,
          name: keyword,
          type,
          confidence: 0.8,
          language
        });
      }
    });
  });

  return entities;
}

async function extractRelationships(content, entities) {
  // Mock relationship extraction
  const relationships = [];

  for (let i = 0; i < entities.length - 1; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      relationships.push({
        id: `rel_${entities[i].id}_${entities[j].id}`,
        source: entities[i].id,
        target: entities[j].id,
        type: 'related_to',
        confidence: 0.6,
        context: 'document_cooccurrence'
      });
    }
  }

  return relationships;
}

async function updateKnowledgeGraph(document) {
  // Mock implementation - update graph database
  console.log('Updating knowledge graph with document:', document.documentId);
  return true;
}

async function searchDocuments(criteria, sortBy, page, limit, searchResults) {
  // Mock document search
  const documents = [];
  for (let i = 0; i < limit; i++) {
    documents.push({
      documentId: `doc_${page}_${i}`,
      title: `Sample Document ${i}`,
      summary: `Summary of document ${i}`,
      category: criteria.category || 'general',
      tags: criteria.tags || ['sample'],
      language: criteria.language || 'sw',
      authorId: 'user_123',
      createdAt: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      relevance: Math.random()
    });
  }
  return documents;
}

async function getDocument(documentId) {
  return {
    documentId,
    title: 'Sample Document',
    content: 'Full document content...',
    summary: 'Document summary',
    category: 'general',
    tags: ['sample'],
    language: 'sw',
    authorId: 'user_123',
    entities: [],
    relationships: [],
    createdAt: new Date().toISOString()
  };
}

async function getRelatedDocuments(documentId) {
  return [
    {
      documentId: 'doc_related_1',
      title: 'Related Document 1',
      relevance: 0.9
    }
  ];
}

async function getGraphContext(entities) {
  return {
    nodes: entities,
    relationships: [],
    centrality: {}
  };
}

async function removeFromKnowledgeGraph(documentId) {
  console.log('Removing document from knowledge graph:', documentId);
  return true;
}

async function getContextDocuments(searchResults) {
  return searchResults.map(result => ({
    documentId: result.documentId,
    title: result.title,
    content: result.content || result.summary,
    relevance: result.relevance || 0.8
  }));
}

async function generateAnswer(query, reasoningResult, contextDocuments) {
  // Mock answer generation
  return {
    text: `Based on the knowledge base, here's the answer to: "${query}"`,
    confidence: reasoningResult.confidence || 0.8,
    sources: contextDocuments.map(doc => doc.documentId)
  };
}

async function generateFollowUpQuestions(query, answer) {
  return [
    'Can you provide more details about this topic?',
    'What are the related concepts?',
    'How does this apply to Tanzania?'
  ];
}

async function exploreKnowledgeGraph(entityId, relationshipType, depth, limit) {
  return {
    nodes: [],
    relationships: [],
    paths: []
  };
}

async function getEntity(entityId) {
  return {
    entityId,
    name: 'Sample Entity',
    type: 'concept',
    description: 'Entity description',
    properties: {},
    language: 'sw'
  };
}

async function getRelatedEntities(entityId) {
  return [];
}

async function getEntityDocuments(entityId) {
  return [];
}

async function getEntityGraphContext(entityId) {
  return {};
}

async function addEntityToGraph(entity) {
  console.log('Adding entity to graph:', entity.entityId);
  return true;
}

async function getKnowledgeStats() {
  return {
    totalDocuments: 150,
    totalEntities: 500,
    totalRelationships: 1200,
    languages: ['sw', 'en', 'fr'],
    categories: ['general', 'politics', 'education', 'health'],
    lastUpdated: new Date().toISOString()
  };
}

async function getSingularityNETStats() {
  return {
    queriesProcessed: 1250,
    averageResponseTime: 450,
    successRate: 0.94
  };
}

module.exports = { router, initializeServices };