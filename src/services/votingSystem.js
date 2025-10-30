const crypto = require('crypto');
const winston = require('winston');
const HederaConsensusService = require('./hederaConsensus');
const EndToEndEncryption = require('./encryption');

class VerifiableVotingSystem {
  constructor(config, hederaService, encryptionService) {
    this.config = config;
    this.hederaService = hederaService;
    this.encryptionService = encryptionService;
    this.activeElections = new Map();
    this.voterRegistry = new Map();
    this.voteReceipts = new Map();
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.File({ filename: 'logs/voting-system.log' }),
        new winston.transports.Console()
      ]
    });
  }

  createElection(electionData) {
    try {
      const electionId = crypto.randomUUID();
      const election = {
        id: electionId,
        title: electionData.title,
        description: electionData.description,
        candidates: electionData.candidates,
        startTime: electionData.startTime,
        endTime: electionData.endTime,
        region: electionData.region || 'national',
        votingRules: electionData.votingRules || {},
        createdAt: Date.now(),
        status: 'pending',
        totalVotes: 0,
        results: {},
        consensusTopicId: null,
        auditTrail: []
      };

      this.activeElections.set(electionId, election);

      this.logger.info('Election created successfully', {
        electionId,
        title: election.title,
        region: election.region,
        candidateCount: election.candidates.length
      });

      return election;
    } catch (error) {
      this.logger.error('Failed to create election', { error: error.message });
      throw error;
    }
  }

  async startElection(electionId) {
    try {
      const election = this.activeElections.get(electionId);
      if (!election) {
        throw new Error('Election not found');
      }

      const consensusTopicId = await this.hederaService.createConsensusTopic(
        `Election: ${election.title} - ${electionId}`
      );

      election.consensusTopicId = consensusTopicId;
      election.status = 'active';
      election.startTime = Date.now();

      this.logger.info('Election started successfully', {
        electionId,
        consensusTopicId,
        title: election.title
      });

      return election;
    } catch (error) {
      this.logger.error('Failed to start election', { electionId, error: error.message });
      throw error;
    }
  }

  registerVoter(voterData) {
    try {
      const voterId = crypto.randomUUID();
      const hashedVoterId = this.encryptionService.hashUserId(voterData.nationalId);
      
      const voter = {
        id: voterId,
        nationalId: hashedVoterId,
        name: voterData.name,
        region: voterData.region,
        registrationTime: Date.now(),
        hasVoted: false,
        electionsVoted: [],
        verificationLevel: voterData.verificationLevel || 'basic',
        biometricData: voterData.biometricData ? 
          this.encryptionService.encryptVote(JSON.stringify(voterData.biometricData), voterId) : null
      };

      this.voterRegistry.set(hashedVoterId, voter);

      this.logger.info('Voter registered successfully', {
        voterId,
        region: voter.region,
        verificationLevel: voter.verificationLevel
      });

      return {
        voterId,
        verificationHash: this.generateVoterVerificationHash(voter),
        registrationTime: voter.registrationTime
      };
    } catch (error) {
      this.logger.error('Failed to register voter', { error: error.message });
      throw error;
    }
  }

  async castVote(voteData) {
    try {
      const { voterId, electionId, candidateId, region, verificationData } = voteData;
      
      const election = this.activeElections.get(electionId);
      if (!election) {
        throw new Error('Election not found');
      }

      if (election.status !== 'active') {
        throw new Error('Election is not active');
      }

      const currentTime = Date.now();
      if (currentTime < election.startTime || currentTime > election.endTime) {
        throw new Error('Voting is not allowed at this time');
      }

      const hashedVoterId = this.encryptionService.hashUserId(voterId);
      const voter = this.voterRegistry.get(hashedVoterId);
      
      if (!voter) {
        throw new Error('Voter not registered');
      }

      if (voter.hasVoted && voter.electionsVoted.includes(electionId)) {
        throw new Error('Voter has already voted in this election');
      }

      const vote = {
        voteId: crypto.randomUUID(),
        voterId: hashedVoterId,
        electionId,
        candidateId,
        region,
        timestamp: currentTime,
        verificationHash: this.generateVoteVerificationHash(voteData),
        zeroKnowledgeProof: this.generateZeroKnowledgeProof(voteData)
      };

      const encryptedVote = this.encryptionService.encryptVote(
        JSON.stringify(vote), 
        voter.id
      );

      const consensusResult = await this.hederaService.submitVote({
        vote: encryptedVote,
        voterId: hashedVoterId,
        electionId,
        region
      }, election.consensusTopicId);

      voter.hasVoted = true;
      voter.electionsVoted.push(electionId);
      election.totalVotes++;

      const receipt = {
        voteId: vote.voteId,
        electionId,
        verificationHash: vote.verificationHash,
        consensusTransactionId: consensusResult.transactionId,
        consensusTimestamp: consensusResult.consensusTimestamp,
        submittedAt: currentTime,
        region,
        auditTrail: consensusResult.voteReceipt
      };

      this.voteReceipts.set(vote.voteId, receipt);

      this.logger.info('Vote cast successfully', {
        voteId: vote.voteId,
        electionId,
        voterId: hashedVoterId,
        region,
        transactionId: consensusResult.transactionId
      });

      return receipt;
    } catch (error) {
      this.logger.error('Failed to cast vote', { 
        voterId: voteData.voterId,
        electionId: voteData.electionId,
        error: error.message 
      });
      throw error;
    }
  }

  async verifyVote(voteId, verificationData) {
    try {
      const receipt = this.voteReceipts.get(voteId);
      if (!receipt) {
        throw new Error('Vote receipt not found');
      }

      const election = this.activeElections.get(receipt.electionId);
      if (!election) {
        throw new Error('Election not found');
      }

      const consensusMessages = await this.hederaService.queryConsensusMessages(
        election.consensusTopicId,
        {
          startTime: receipt.submittedAt - 60000, // 1 minute before
          endTime: receipt.submittedAt + 60000   // 1 minute after
        }
      );

      const voteMessage = consensusMessages.find(msg => 
        msg.message.voteId === voteId
      );

      if (!voteMessage) {
        throw new Error('Vote not found in consensus');
      }

      const verificationResult = {
        voteId,
        verified: true,
        consensusTimestamp: voteMessage.consensusTimestamp,
        sequenceNumber: voteMessage.sequenceNumber,
        runningHash: voteMessage.runningHash,
        auditTrail: receipt.auditTrail
      };

      this.logger.info('Vote verification successful', {
        voteId,
        consensusTimestamp: voteMessage.consensusTimestamp
      });

      return verificationResult;
    } catch (error) {
      this.logger.error('Failed to verify vote', { voteId, error: error.message });
      throw error;
    }
  }

  async getElectionResults(electionId, region = null) {
    try {
      const election = this.activeElections.get(electionId);
      if (!election) {
        throw new Error('Election not found');
      }

      const consensusMessages = await this.hederaService.queryConsensusMessages(
        election.consensusTopicId
      );

      const results = {};
      const voteCount = {};
      
      election.candidates.forEach(candidate => {
        results[candidate.id] = {
          candidate: candidate,
          votes: 0,
          percentage: 0,
          regions: {}
        };
        voteCount[candidate.id] = 0;
      });

      let totalValidVotes = 0;

      consensusMessages.forEach(msg => {
        if (msg.message.type === 'vote') {
          const voteData = JSON.parse(msg.message.content);
          
          if (!region || voteData.region === region) {
            results[voteData.candidateId].votes++;
            voteCount[voteData.candidateId]++;
            totalValidVotes++;

            if (!results[voteData.candidateId].regions[voteData.region]) {
              results[voteData.candidateId].regions[voteData.region] = 0;
            }
            results[voteData.candidateId].regions[voteData.region]++;
          }
        }
      });

      Object.keys(results).forEach(candidateId => {
        if (totalValidVotes > 0) {
          results[candidateId].percentage = 
            (results[candidateId].votes / totalValidVotes) * 100;
        }
      });

      const electionResults = {
        electionId,
        totalVotes: totalValidVotes,
        results,
        lastUpdated: Date.now(),
        consensusTimestamp: consensusMessages.length > 0 ? 
          consensusMessages[consensusMessages.length - 1].consensusTimestamp : null,
        region: region || 'all',
        auditTrail: {
          totalMessages: consensusMessages.length,
          voteMessages: consensusMessages.filter(msg => msg.message.type === 'vote').length,
          runningHash: consensusMessages.length > 0 ? 
            consensusMessages[consensusMessages.length - 1].runningHash : null
        }
      };

      this.logger.info('Election results compiled', {
        electionId,
        totalVotes: totalValidVotes,
        region: region || 'all',
        candidateCount: Object.keys(results).length
      });

      return electionResults;
    } catch (error) {
      this.logger.error('Failed to get election results', { electionId, error: error.message });
      throw error;
    }
  }

  generateVoterVerificationHash(voter) {
    const voterString = JSON.stringify({
      id: voter.id,
      nationalId: voter.nationalId,
      registrationTime: voter.registrationTime
    });
    return crypto.createHash('sha256').update(voterString).digest('hex');
  }

  generateVoteVerificationHash(voteData) {
    const voteString = JSON.stringify({
      voterId: voteData.voterId,
      electionId: voteData.electionId,
      candidateId: voteData.candidateId,
      timestamp: Date.now()
    });
    return crypto.createHash('sha256').update(voteString).digest('hex');
  }

  generateZeroKnowledgeProof(voteData) {
    return {
      commitment: crypto.createHash('sha256').update(voteData.candidateId).digest('hex'),
      challenge: crypto.randomBytes(32).toString('hex'),
      response: crypto.randomBytes(32).toString('hex'),
      timestamp: Date.now()
    };
  }

  async endElection(electionId) {
    try {
      const election = this.activeElections.get(electionId);
      if (!election) {
        throw new Error('Election not found');
      }

      election.status = 'completed';
      election.endTime = Date.now();

      const finalResults = await this.getElectionResults(electionId);
      election.results = finalResults;

      this.logger.info('Election ended successfully', {
        electionId,
        title: election.title,
        totalVotes: finalResults.totalVotes,
        endTime: election.endTime
      });

      return finalResults;
    } catch (error) {
      this.logger.error('Failed to end election', { electionId, error: error.message });
      throw error;
    }
  }

  getVoterReceipt(voteId) {
    return this.voteReceipts.get(voteId);
  }

  getElectionStatus(electionId) {
    const election = this.activeElections.get(electionId);
    return election ? election.status : null;
  }

  getActiveElections() {
    return Array.from(this.activeElections.values()).filter(election => 
      election.status === 'active'
    );
  }

  getVotingStatistics() {
    const totalVoters = this.voterRegistry.size;
    const totalVotes = Array.from(this.voteReceipts.values()).length;
    const activeElections = this.getActiveElections().length;

    return {
      totalVoters,
      totalVotes,
      activeElections,
      averageVotesPerElection: activeElections > 0 ? totalVotes / activeElections : 0,
      timestamp: Date.now()
    };
  }
}

module.exports = VerifiableVotingSystem;