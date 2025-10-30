const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Import services (will be injected by main server)
let votingSystem;
let consensusService;
let encryptionService;
let singularityNET;
let mettaRuntime;
let hyperonProcessor;

// Initialize services function (called from main server)
const initializeServices = (services) => {
  votingSystem = services.votingSystem;
  consensusService = services.consensusService;
  encryptionService = services.encryptionService;
  singularityNET = services.singularityNET;
  mettaRuntime = services.mettaRuntime;
  hyperonProcessor = services.hyperonProcessor;
};

// Election Management Routes

// Create new election (Admin only)
router.post('/elections', authenticateToken, authorizeRoles(['admin']), asyncHandler(async (req, res) => {
  const { title, description, candidates, startTime, endTime, region, votingRules } = req.body;

  // Validate required fields
  if (!title || !description || !candidates || !startTime || !endTime) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['title', 'description', 'candidates', 'startTime', 'endTime']
    });
  }

  // Validate candidates array
  if (!Array.isArray(candidates) || candidates.length < 2) {
    return res.status(400).json({
      error: 'At least 2 candidates required'
    });
  }

  // Use AI to evaluate election parameters
  const aiEvaluation = await hyperonProcessor.processDecision(
    { type: 'election-creation', candidates: candidates.length, region },
    ['approve', 'review', 'reject']
  );

  if (aiEvaluation.decision === 'reject') {
    return res.status(400).json({
      error: 'Election parameters rejected by AI evaluation',
      reason: aiEvaluation.reasoning
    });
  }

  const electionData = {
    title,
    description,
    candidates,
    startTime: new Date(startTime).getTime(),
    endTime: new Date(endTime).getTime(),
    region: region || 'national',
    votingRules: votingRules || {}
  };

  const election = votingSystem.createElection(electionData);

  res.status(201).json({
    message: 'Election created successfully',
    election: {
      id: election.id,
      title: election.title,
      description: election.description,
      candidates: election.candidates,
      startTime: election.startTime,
      endTime: election.endTime,
      region: election.region,
      status: election.status,
      aiEvaluation: aiEvaluation.decision
    }
  });
}));

// Get all elections
router.get('/elections', asyncHandler(async (req, res) => {
  const { status, region, page = 1, limit = 20 } = req.query;

  let elections = Array.from(votingSystem.activeElections.values());

  // Filter by status
  if (status) {
    elections = elections.filter(election => election.status === status);
  }

  // Filter by region
  if (region) {
    elections = elections.filter(election => election.region === region);
  }

  // Pagination
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedElections = elections.slice(startIndex, endIndex);

  res.json({
    elections: paginatedElections.map(election => ({
      id: election.id,
      title: election.title,
      description: election.description,
      startTime: election.startTime,
      endTime: election.endTime,
      region: election.region,
      status: election.status,
      totalVotes: election.totalVotes,
      candidateCount: election.candidates.length
    })),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: elections.length,
      pages: Math.ceil(elections.length / limit)
    }
  });
}));

// Get specific election
router.get('/elections/:electionId', asyncHandler(async (req, res) => {
  const { electionId } = req.params;
  const election = votingSystem.activeElections.get(electionId);

  if (!election) {
    return res.status(404).json({ error: 'Election not found' });
  }

  res.json({
    election: {
      id: election.id,
      title: election.title,
      description: election.description,
      candidates: election.candidates,
      startTime: election.startTime,
      endTime: election.endTime,
      region: election.region,
      status: election.status,
      totalVotes: election.totalVotes,
      consensusTopicId: election.consensusTopicId,
      createdAt: election.createdAt
    }
  });
}));

// Start election (Admin only)
router.post('/elections/:electionId/start', authenticateToken, authorizeRoles(['admin']), asyncHandler(async (req, res) => {
  const { electionId } = req.params;

  const election = await votingSystem.startElection(electionId);

  res.json({
    message: 'Election started successfully',
    election: {
      id: election.id,
      title: election.title,
      status: election.status,
      startTime: election.startTime,
      consensusTopicId: election.consensusTopicId
    }
  });
}));

// End election (Admin only)
router.post('/elections/:electionId/end', authenticateToken, authorizeRoles(['admin']), asyncHandler(async (req, res) => {
  const { electionId } = req.params;

  const results = await votingSystem.endElection(electionId);

  res.json({
    message: 'Election ended successfully',
    results
  });
}));

// Voter Registration Routes

// Register voter
router.post('/voters/register', authenticateToken, asyncHandler(async (req, res) => {
  const { nationalId, name, region, biometricData, verificationLevel } = req.body;

  // Validate required fields
  if (!nationalId || !name || !region) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['nationalId', 'name', 'region']
    });
  }

  // Use AI for biometric verification if provided
  let biometricVerification = null;
  if (biometricData) {
    try {
      biometricVerification = await singularityNET.executeWorkflow({
        type: 'biometric-verification',
        data: biometricData,
        context: { region, verificationLevel: verificationLevel || 'basic' }
      });
    } catch (error) {
      console.warn('Biometric verification failed:', error.message);
    }
  }

  const voterData = {
    nationalId,
    name,
    region,
    biometricData,
    verificationLevel: verificationLevel || 'basic'
  };

  const registration = votingSystem.registerVoter(voterData);

  res.status(201).json({
    message: 'Voter registered successfully',
    registration: {
      voterId: registration.voterId,
      verificationHash: registration.verificationHash,
      registrationTime: registration.registrationTime,
      biometricVerified: biometricVerification ? true : false
    }
  });
}));

// Get voter status
router.get('/voters/:voterId/status', authenticateToken, asyncHandler(async (req, res) => {
  const { voterId } = req.params;

  // Hash the voter ID for lookup
  const hashedVoterId = encryptionService.hashUserId(voterId);
  const voter = votingSystem.voterRegistry.get(hashedVoterId);

  if (!voter) {
    return res.status(404).json({ error: 'Voter not found' });
  }

  res.json({
    voter: {
      id: voter.id,
      region: voter.region,
      registrationTime: voter.registrationTime,
      hasVoted: voter.hasVoted,
      electionsVoted: voter.electionsVoted.length,
      verificationLevel: voter.verificationLevel
    }
  });
}));

// Voting Routes

// Cast vote
router.post('/vote', authenticateToken, asyncHandler(async (req, res) => {
  const { electionId, candidateId, region, verificationData } = req.body;
  const voterId = req.user.id; // From JWT token

  // Validate required fields
  if (!electionId || !candidateId || !region) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['electionId', 'candidateId', 'region']
    });
  }

  // Use AI for fraud detection
  const fraudAnalysis = await singularityNET.executeWorkflow({
    type: 'fraud-detection',
    data: {
      voterId,
      electionId,
      candidateId,
      region,
      timestamp: Date.now(),
      verificationData
    },
    context: { sensitivity: 'high' }
  });

  if (fraudAnalysis.result === 'suspicious') {
    return res.status(403).json({
      error: 'Vote flagged for potential fraud',
      reason: fraudAnalysis.reason,
      verificationRequired: true
    });
  }

  // Use MeTTa for policy compliance check
  const policyCheck = await mettaRuntime.evaluatePolicy({
    type: 'voting-eligibility',
    voterId,
    electionId,
    region,
    timestamp: Date.now()
  });

  if (policyCheck.recommendation.action === 'reject') {
    return res.status(403).json({
      error: 'Voting not allowed',
      reason: policyCheck.recommendation.reasoning
    });
  }

  const voteData = {
    voterId,
    electionId,
    candidateId,
    region,
    verificationData
  };

  const receipt = await votingSystem.castVote(voteData);

  res.json({
    message: 'Vote cast successfully',
    receipt: {
      voteId: receipt.voteId,
      electionId: receipt.electionId,
      verificationHash: receipt.verificationHash,
      consensusTransactionId: receipt.consensusTransactionId,
      consensusTimestamp: receipt.consensusTimestamp,
      submittedAt: receipt.submittedAt,
      region: receipt.region
    }
  });
}));

// Verify vote
router.get('/votes/:voteId/verify', asyncHandler(async (req, res) => {
  const { voteId } = req.params;

  const verification = await votingSystem.verifyVote(voteId);

  res.json({
    message: 'Vote verification successful',
    verification
  });
}));

// Get vote receipt
router.get('/votes/:voteId/receipt', authenticateToken, asyncHandler(async (req, res) => {
  const { voteId } = req.params;
  const voterId = req.user.id;

  const receipt = votingSystem.getVoterReceipt(voteId);

  if (!receipt) {
    return res.status(404).json({ error: 'Vote receipt not found' });
  }

  // Verify ownership (basic check - in production, use cryptographic proof)
  const hashedVoterId = encryptionService.hashUserId(voterId);
  const voter = votingSystem.voterRegistry.get(hashedVoterId);

  if (!voter || !voter.electionsVoted.includes(receipt.electionId)) {
    return res.status(403).json({ error: 'Access denied to this receipt' });
  }

  res.json({
    receipt: {
      voteId: receipt.voteId,
      electionId: receipt.electionId,
      verificationHash: receipt.verificationHash,
      consensusTransactionId: receipt.consensusTransactionId,
      consensusTimestamp: receipt.consensusTimestamp,
      submittedAt: receipt.submittedAt,
      region: receipt.region
    }
  });
}));

// Results Routes

// Get election results
router.get('/elections/:electionId/results', asyncHandler(async (req, res) => {
  const { electionId } = req.params;
  const { region } = req.query;

  const results = await votingSystem.getElectionResults(electionId, region);

  res.json({
    message: 'Election results retrieved successfully',
    results
  });
}));

// Get real-time election statistics
router.get('/elections/:electionId/stats', asyncHandler(async (req, res) => {
  const { electionId } = req.params;
  const election = votingSystem.activeElections.get(electionId);

  if (!election) {
    return res.status(404).json({ error: 'Election not found' });
  }

  // Get real-time stats from consensus
  let consensusStats = {};
  if (election.consensusTopicId) {
    try {
      const messages = await consensusService.queryConsensusMessages(election.consensusTopicId);
      consensusStats = {
        totalMessages: messages.length,
        voteMessages: messages.filter(msg => msg.message.type === 'vote').length,
        lastConsensusTimestamp: messages.length > 0 ?
          messages[messages.length - 1].consensusTimestamp : null
      };
    } catch (error) {
      console.warn('Failed to get consensus stats:', error.message);
    }
  }

  const stats = {
    electionId,
    status: election.status,
    totalVotes: election.totalVotes,
    timeRemaining: election.endTime - Date.now(),
    consensusStats,
    timestamp: Date.now()
  };

  res.json({
    message: 'Election statistics retrieved successfully',
    stats
  });
}));

// Analytics Routes

// Get voting analytics (Admin only)
router.get('/analytics/voting', authenticateToken, authorizeRoles(['admin']), asyncHandler(async (req, res) => {
  const { startDate, endDate, region } = req.query;

  // Use AI for advanced analytics
  const analytics = await singularityNET.executeWorkflow({
    type: 'voting-analytics',
    data: {
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      region
    },
    context: { depth: 'comprehensive' }
  });

  const systemStats = votingSystem.getVotingStatistics();

  res.json({
    message: 'Voting analytics retrieved successfully',
    analytics: {
      systemStats,
      aiInsights: analytics.result,
      trends: analytics.trends || [],
      predictions: analytics.predictions || []
    }
  });
}));

// AI-Powered Decision Support

// Get election recommendations
router.get('/ai/election-recommendations', authenticateToken, authorizeRoles(['admin']), asyncHandler(async (req, res) => {
  const { context } = req.query;

  const recommendations = await mettaRuntime.reason(
    `(recommend-election-parameters ${context || 'general'})`
  );

  const hyperonAnalysis = await hyperonProcessor.processDecision(
    { type: 'election-planning', context },
    ['optimize-timing', 'expand-reach', 'enhance-security', 'maintain-status-quo']
  );

  res.json({
    message: 'AI election recommendations generated',
    recommendations: {
      mettaReasoning: recommendations,
      hyperonAnalysis: hyperonAnalysis,
      suggestedActions: [
        'Consider regional voting centers',
        'Implement additional verification layers',
        'Schedule voter education campaigns'
      ]
    }
  });
}));

// Anomaly detection for elections
router.get('/ai/anomalies/:electionId', authenticateToken, authorizeRoles(['admin']), asyncHandler(async (req, res) => {
  const { electionId } = req.params;

  const election = votingSystem.activeElections.get(electionId);
  if (!election) {
    return res.status(404).json({ error: 'Election not found' });
  }

  const anomalies = await hyperonProcessor.detectAnomalies({
    electionId,
    totalVotes: election.totalVotes,
    region: election.region,
    timeElapsed: Date.now() - election.startTime,
    consensusMessages: election.auditTrail || []
  });

  res.json({
    message: 'Anomaly detection completed',
    anomalies
  });
}));

module.exports = { router, initializeServices };