const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const { createServer } = require('http');
const { Server } = require('socket.io');

// Import services
const EndToEndEncryption = require('../services/encryption');
const HederaConsensusService = require('../services/hederaConsensus');
const VerifiableVotingSystem = require('../services/votingSystem');

// Import routes
const { router: identityRoutes, setServices: setIdentityServices } = require('./routes/identity');
const { router: votingRoutes, initializeServices: initializeVotingServices } = require('./routes/voting');
const { router: socialRoutes, initializeServices: initializeSocialServices } = require('./routes/social');
const { router: knowledgeRoutes, initializeServices: initializeKnowledgeServices } = require('./routes/knowledge');
const { router: analyticsRoutes, initializeServices: initializeAnalyticsServices } = require('./routes/analytics');

// Import middleware
const { authenticateToken, authorizeRoles } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');
const { requestLogger } = require('./middleware/logging');

// Import AI integrations
const { SingularityNETAgent } = require('./ai/singularitynet');
const { MeTTaRuntime } = require('./ai/metta');
const { HyperonProcessor } = require('./ai/hyperon');

// Load environment variables
require('dotenv').config();

class TanzaniaPlatformServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.io = null;

    // Initialize core services
    this.encryption = new EndToEndEncryption();
    this.consensus = new HederaConsensusService(process.env);
    this.voting = new VerifiableVotingSystem(process.env, this.consensus, this.encryption);

    // Initialize AI services
    this.singularityNET = new SingularityNETAgent();
    this.metta = new MeTTaRuntime();
    this.hyperon = new HyperonProcessor();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/', limiter);

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging
    this.app.use(requestLogger);
  }

  setupRoutes() {
    // Initialize identity services
    setIdentityServices({
      consensus: this.consensus,
      encryption: this.encryption
    });

    // Initialize voting services
    initializeVotingServices({
      votingSystem: this.voting,
      consensusService: this.consensus,
      encryptionService: this.encryption,
      singularityNET: this.singularityNET,
      mettaRuntime: this.metta,
      hyperonProcessor: this.hyperon
    });

    // Initialize social services
    initializeSocialServices({
      encryptionService: this.encryption,
      consensusService: this.consensus,
      singularityNET: this.singularityNET,
      mettaRuntime: this.metta,
      hyperonProcessor: this.hyperon
    });

    // Initialize knowledge services
    initializeKnowledgeServices({
      encryptionService: this.encryption,
      consensusService: this.consensus,
      singularityNET: this.singularityNET,
      mettaRuntime: this.metta,
      hyperonProcessor: this.hyperon
    });

    // Initialize analytics services
    initializeAnalyticsServices({
      encryptionService: this.encryption,
      consensusService: this.consensus,
      singularityNET: this.singularityNET,
      mettaRuntime: this.metta,
      hyperonProcessor: this.hyperon
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          encryption: 'active',
          consensus: 'active',
          voting: 'active',
          ai: 'active'
        }
      });
    });

    // Readiness check
    this.app.get('/ready', (req, res) => {
      res.json({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    });

    // API routes
    this.app.use('/api/v1/identity', identityRoutes);
    this.app.use('/api/v1/voting', votingRoutes);
    this.app.use('/api/v1/social', socialRoutes);
    this.app.use('/api/v1/knowledge', knowledgeRoutes);
    this.app.use('/api/v1/analytics', analyticsRoutes);

    // Protected routes middleware
    this.app.use('/api/v1/protected', authenticateToken);

    // Admin routes (require admin role)
    this.app.use('/api/v1/admin', authenticateToken, authorizeRoles(['admin']));

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: 'The requested resource was not found',
        path: req.path
      });
    });
  }

  setupWebSocket() {
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    // WebSocket connection handling
    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);

      // Join user-specific room for real-time updates
      socket.on('join-user-room', (userId) => {
        socket.join(`user-${userId}`);
      });

      // Join voting room for election updates
      socket.on('join-voting-room', (electionId) => {
        socket.join(`election-${electionId}`);
      });

      // Handle real-time voting updates
      socket.on('vote-cast', async (data) => {
        try {
          // Process vote through consensus
          const result = await this.voting.castVote(data);
          // Broadcast to election room
          this.io.to(`election-${data.electionId}`).emit('vote-update', result);
        } catch (error) {
          socket.emit('vote-error', { error: error.message });
        }
      });

      // Handle social interactions
      socket.on('post-created', (post) => {
        // Broadcast to relevant communities
        this.io.to(`community-${post.communityId}`).emit('new-post', post);
      });

      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
      });
    });
  }

  setupErrorHandling() {
    this.app.use(errorHandler);
  }

  async initializeServices() {
    try {
      // Initialize Hedera consensus
      await this.consensus.initialize();

      // Initialize AI services
      await this.singularityNET.initialize();
      await this.metta.initialize();
      await this.hyperon.initialize();

      console.log('All services initialized successfully');
    } catch (error) {
      console.error('Service initialization failed:', error);
      throw error;
    }
  }

  async start(port = process.env.PORT || 3000) {
    try {
      await this.initializeServices();

      this.server.listen(port, () => {
        console.log(`Tanzania Platform Server running on port ${port}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`Health check: http://localhost:${port}/health`);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  async stop() {
    if (this.server) {
      this.server.close();
    }
    if (this.io) {
      this.io.close();
    }
    console.log('Server stopped');
  }

  // Method to broadcast real-time updates
  broadcastToRoom(room, event, data) {
    if (this.io) {
      this.io.to(room).emit(event, data);
    }
  }

  // Method to send notification to specific user
  notifyUser(userId, event, data) {
    if (this.io) {
      this.io.to(`user-${userId}`).emit(event, data);
    }
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  const server = new TanzaniaPlatformServer();
  server.stop().then(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  const server = new TanzaniaPlatformServer();
  server.stop().then(() => process.exit(0));
});

// Export for testing
module.exports = { TanzaniaPlatformServer };

// Start server if called directly
if (require.main === module) {
  const server = new TanzaniaPlatformServer();
  server.start();
}