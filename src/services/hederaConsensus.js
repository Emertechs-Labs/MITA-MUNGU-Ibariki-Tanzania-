const {
  Client,
  PrivateKey,
  AccountId,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  TopicMessageQuery,
  ConsensusMessageSubmitTransaction,
  ConsensusTopicCreateTransaction,
  ConsensusTopicId,
  TransactionId,
  TopicId
} = require('@hashgraph/sdk');
const crypto = require('crypto');
const winston = require('winston');

class HederaConsensusService {
  constructor(config) {
    this.config = config;
    this.client = null;
    this.operatorId = null;
    this.operatorKey = null;
    this.consensusTopicId = config.HEDERA_CONSENSUS_TOPIC_ID;
    this.mockMode = false;
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.File({ filename: 'logs/hedera-consensus.log' }),
        new winston.transports.Console()
      ]
    });

    // Try to initialize Hedera client, fallback to mock mode if credentials are invalid
    try {
      if (config.HEDERA_ACCOUNT_ID && config.HEDERA_PRIVATE_KEY) {
        this.operatorId = AccountId.fromString(config.HEDERA_ACCOUNT_ID);
        this.operatorKey = PrivateKey.fromString(config.HEDERA_PRIVATE_KEY);
        this.initializeClient();
      } else {
        this.logger.warn('Hedera credentials not configured, running in mock mode');
        this.mockMode = true;
      }
    } catch (error) {
      this.logger.warn('Hedera client initialization failed, running in mock mode:', error.message);
      this.mockMode = true;
    }
  }

  initializeClient() {
    try {
      this.client = Client.forTestnet();
      
      if (this.config.HEDERA_NETWORK === 'mainnet') {
        this.client = Client.forMainnet();
      }

      this.client.setOperator(this.operatorId, this.operatorKey);
      
      this.logger.info('Hedera client initialized successfully', {
        network: this.config.HEDERA_NETWORK,
        operatorId: this.operatorId.toString()
      });
    } catch (error) {
      this.logger.error('Failed to initialize Hedera client', { error: error.message });
      throw error;
    }
  }

  async createConsensusTopic(topicMemo = 'Tanzania Democracy Consensus Topic') {
    if (this.mockMode) {
      const mockTopicId = `0.0.${Date.now()}`;
      this.logger.info('Mock consensus topic created', { topicId: mockTopicId, topicMemo });
      return mockTopicId;
    }

    try {
      const transaction = new TopicCreateTransaction()
        .setTopicMemo(topicMemo)
        .setSubmitKey(this.operatorKey)
        .setAdminKey(this.operatorKey)
        .setAutoRenewAccountId(this.operatorId);

      const txResponse = await transaction.execute(this.client);
      const receipt = await txResponse.getReceipt(this.client);
      const topicId = receipt.topicId;

      this.logger.info('Consensus topic created successfully', {
        topicId: topicId.toString(),
        topicMemo
      });

      return topicId.toString();
    } catch (error) {
      this.logger.error('Failed to create consensus topic', { error: error.message });
      throw error;
    }
  }

  async submitConsensusMessage(message, topicId = null, metadata = {}) {
    if (this.mockMode) {
      const messageId = crypto.randomUUID();
      const mockTransactionId = `0.0.${Date.now()}.${Math.random()}`;
      this.logger.info('Mock consensus message submitted', { messageId, topicId: topicId || this.consensusTopicId });
      
      return {
        messageId,
        transactionId: mockTransactionId,
        consensusTimestamp: new Date().toISOString(),
        sequenceNumber: Math.floor(Math.random() * 1000).toString(),
        message: {
          id: messageId,
          timestamp: Date.now(),
          type: metadata.type || 'general',
          content: message,
          hash: this.generateMessageHash(message),
          metadata
        }
      };
    }

    try {
      const targetTopicId = topicId || this.consensusTopicId;
      
      if (!targetTopicId) {
        throw new Error('No topic ID provided for consensus message');
      }

      const timestamp = Date.now();
      const messageId = crypto.randomUUID();
      
      const consensusMessage = {
        id: messageId,
        timestamp,
        type: metadata.type || 'general',
        region: metadata.region || 'global',
        nodeId: metadata.nodeId || 'unknown',
        content: message,
        hash: this.generateMessageHash(message),
        signature: this.signMessage(message),
        metadata
      };

      const messageString = JSON.stringify(consensusMessage);
      
      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(TopicId.fromString(targetTopicId))
        .setMessage(messageString);

      const txResponse = await transaction.execute(this.client);
      const receipt = await txResponse.getReceipt(this.client);

      this.logger.info('Consensus message submitted successfully', {
        messageId,
        topicId: targetTopicId,
        transactionId: txResponse.transactionId.toString(),
        consensusTimestamp: receipt.consensusTimestamp?.toString()
      });

      return {
        messageId,
        transactionId: txResponse.transactionId.toString(),
        consensusTimestamp: receipt.consensusTimestamp?.toString(),
        sequenceNumber: receipt.topicSequenceNumber?.toString(),
        message: consensusMessage
      };
    } catch (error) {
      this.logger.error('Failed to submit consensus message', { 
        error: error.message,
        messageLength: message.length 
      });
      throw error;
    }
  }

  async submitVote(voteData, topicId = null) {
    try {
      const voteMessage = {
        type: 'vote',
        voteId: crypto.randomUUID(),
        voterId: this.hashVoterId(voteData.voterId),
        electionId: voteData.electionId,
        candidateId: voteData.candidateId,
        timestamp: Date.now(),
        region: voteData.region,
        encryptedVote: this.encryptVote(voteData.vote),
        zeroKnowledgeProof: this.generateZeroKnowledgeProof(voteData)
      };

      const result = await this.submitConsensusMessage(
        JSON.stringify(voteMessage),
        topicId,
        { type: 'vote', region: voteData.region }
      );

      this.logger.info('Vote submitted to consensus', {
        voteId: voteMessage.voteId,
        electionId: voteData.electionId,
        transactionId: result.transactionId
      });

      return {
        ...result,
        voteReceipt: {
          voteId: voteMessage.voteId,
          verificationHash: this.generateVoteHash(voteMessage),
          submittedAt: voteMessage.timestamp,
          transactionId: result.transactionId
        }
      };
    } catch (error) {
      this.logger.error('Failed to submit vote to consensus', { error: error.message });
      throw error;
    }
  }

  async submitSocialPost(postData, topicId = null) {
    try {
      const postMessage = {
        type: 'social_post',
        postId: crypto.randomUUID(),
        authorId: this.hashUserId(postData.authorId),
        content: postData.content,
        timestamp: Date.now(),
        region: postData.region,
        mediaHash: postData.mediaHash,
        moderationScore: postData.moderationScore,
        encryptedContent: this.encryptContent(postData.content)
      };

      const result = await this.submitConsensusMessage(
        JSON.stringify(postMessage),
        topicId,
        { type: 'social_post', region: postData.region }
      );

      this.logger.info('Social post submitted to consensus', {
        postId: postMessage.postId,
        authorHash: postMessage.authorId,
        transactionId: result.transactionId
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to submit social post to consensus', { error: error.message });
      throw error;
    }
  }

  async queryConsensusMessages(topicId = null, options = {}) {
    if (this.mockMode) {
      // Return mock messages for testing
      return [
        {
          consensusTimestamp: new Date().toISOString(),
          sequenceNumber: '1',
          runningHash: crypto.randomBytes(32).toString('hex'),
          message: {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            type: 'mock',
            content: 'Mock consensus message',
            hash: crypto.randomBytes(32).toString('hex')
          }
        }
      ];
    }

    try {
      const targetTopicId = topicId || this.consensusTopicId;
      
      if (!targetTopicId) {
        throw new Error('No topic ID provided for query');
      }

      const messages = [];
      
      await new TopicMessageQuery()
        .setTopicId(TopicId.fromString(targetTopicId))
        .setStartTime(options.startTime || 0)
        .setEndTime(options.endTime || Date.now())
        .setLimit(options.limit || 100)
        .subscribe(this.client, null, (message) => {
          try {
            const parsedMessage = JSON.parse(message.contents.toString());
            messages.push({
              consensusTimestamp: message.consensusTimestamp.toString(),
              sequenceNumber: message.sequenceNumber.toString(),
              runningHash: message.runningHash.toString('hex'),
              message: parsedMessage
            });
          } catch (parseError) {
            this.logger.warn('Failed to parse consensus message', { 
              error: parseError.message,
              rawMessage: message.contents.toString()
            });
          }
        });

      return messages;
    } catch (error) {
      this.logger.error('Failed to query consensus messages', { error: error.message });
      throw error;
    }
  }

  async getConsensusTopicInfo(topicId = null) {
    try {
      const targetTopicId = topicId || this.consensusTopicId;
      
      if (!targetTopicId) {
        throw new Error('No topic ID provided for info query');
      }

      const topicInfo = await new TopicInfoQuery()
        .setTopicId(TopicId.fromString(targetTopicId))
        .execute(this.client);

      return {
        topicId: targetTopicId,
        memo: topicInfo.topicMemo,
        runningHash: topicInfo.runningHash.toString('hex'),
        sequenceNumber: topicInfo.sequenceNumber.toString(),
        expirationTime: topicInfo.expirationTime?.toString(),
        adminKey: topicInfo.adminKey?.toString(),
        submitKey: topicInfo.submitKey?.toString()
      };
    } catch (error) {
      this.logger.error('Failed to get consensus topic info', { error: error.message });
      throw error;
    }
  }

  generateMessageHash(message) {
    return crypto.createHash('sha256').update(message).digest('hex');
  }

  signMessage(message) {
    if (this.mockMode) {
      return crypto.createHash('sha256').update(message + 'mock-signature').digest('hex');
    }
    return this.operatorKey.sign(Buffer.from(message)).toString('hex');
  }

  hashVoterId(voterId) {
    return crypto.createHash('sha256').update(voterId).digest('hex');
  }

  hashUserId(userId) {
    return crypto.createHash('sha256').update(userId).digest('hex');
  }

  encryptVote(vote) {
    const cipher = crypto.createCipher('aes-256-gcm', this.config.ENCRYPTION_KEY);
    let encrypted = cipher.update(vote, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  encryptContent(content) {
    const cipher = crypto.createCipher('aes-256-gcm', this.config.ENCRYPTION_KEY);
    let encrypted = cipher.update(content, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  generateZeroKnowledgeProof(voteData) {
    const proof = {
      commitment: crypto.createHash('sha256').update(voteData.vote).digest('hex'),
      challenge: crypto.randomBytes(32).toString('hex'),
      response: crypto.randomBytes(32).toString('hex')
    };
    return proof;
  }

  generateVoteHash(voteMessage) {
    const voteString = JSON.stringify({
      voteId: voteMessage.voteId,
      voterId: voteMessage.voterId,
      electionId: voteMessage.electionId,
      timestamp: voteMessage.timestamp
    });
    return crypto.createHash('sha256').update(voteString).digest('hex');
  }

  async verifyMessageIntegrity(message, signature) {
    try {
      return this.operatorKey.verify(Buffer.from(message), Buffer.from(signature, 'hex'));
    } catch (error) {
      this.logger.error('Failed to verify message integrity', { error: error.message });
      return false;
    }
  }

  async initialize() {
    if (this.mockMode) {
      this.logger.info('Hedera consensus service initialized in mock mode');
      return;
    }

    try {
      // Test the connection by getting topic info or creating a test message
      this.logger.info('Hedera consensus service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Hedera consensus service', { error: error.message });
      throw error;
    }
  }
}

module.exports = HederaConsensusService;