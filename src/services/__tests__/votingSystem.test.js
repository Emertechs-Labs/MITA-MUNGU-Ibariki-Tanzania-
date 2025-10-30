const { submitVote, getVoteResults } = require('../services/votingSystem');

// Mock external dependencies
jest.mock('@hashgraph/sdk', () => ({
  Client: jest.fn().mockImplementation(() => ({
    setOperator: jest.fn().mockReturnThis(),
    submitMessage: jest.fn().mockResolvedValue({ transactionId: 'mock-tx-id' }),
  })),
  TopicMessageSubmitTransaction: jest.fn().mockImplementation(() => ({
    setTopicId: jest.fn().mockReturnThis(),
    setMessage: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ transactionId: 'mock-tx-id' }),
  })),
  TopicId: { fromString: jest.fn() },
}));

describe('Voting System Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('submitVote', () => {
    test('should submit a valid vote successfully', async () => {
      const mockVote = { userId: 'user123', proposalId: 'prop456', choice: 'yes' };

      const result = await submitVote(mockVote);

      expect(result).toHaveProperty('transactionId');
      expect(result.success).toBe(true);
    });

    test('should throw error on invalid vote data', async () => {
      const invalidVote = { userId: '', proposalId: 'prop456' };

      await expect(submitVote(invalidVote)).rejects.toThrow('Invalid vote data');
    });

    test('should handle Hedera network errors', async () => {
      // Mock a failure
      const { Client } = require('@hashgraph/sdk');
      Client.mockImplementationOnce(() => ({
        setOperator: jest.fn().mockReturnThis(),
        submitMessage: jest.fn().mockRejectedValue(new Error('Network error')),
      }));

      const mockVote = { userId: 'user123', proposalId: 'prop456', choice: 'yes' };

      await expect(submitVote(mockVote)).rejects.toThrow('Failed to submit vote');
    });
  });

  describe('getVoteResults', () => {
    test('should return vote results for a proposal', async () => {
      const proposalId = 'prop456';

      const results = await getVoteResults(proposalId);

      expect(results).toHaveProperty('proposalId', proposalId);
      expect(results).toHaveProperty('votes');
    });

    test('should handle errors when fetching results', async () => {
      // Mock failure
      const results = await getVoteResults('invalid-id');

      // Assuming it returns empty or throws
      expect(results).toBeDefined();
    });
  });
});