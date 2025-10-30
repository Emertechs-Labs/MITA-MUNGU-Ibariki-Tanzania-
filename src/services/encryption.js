const crypto = require('crypto');
const forge = require('node-forge');
const winston = require('winston');

class EndToEndEncryption {
  constructor(config) {
    this.config = config;
    this.keyPairs = new Map();
    this.sessionKeys = new Map();
    this.groupKeys = new Map();
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.File({ filename: 'logs/encryption.log' }),
        new winston.transports.Console()
      ]
    });
  }

  generateKeyPair(userId) {
    try {
      const keyPair = forge.pki.rsa.generateKeyPair({ bits: 2048 });
      const publicKeyPem = forge.pki.publicKeyToPem(keyPair.publicKey);
      const privateKeyPem = forge.pki.privateKeyToPem(keyPair.privateKey);
      
      this.keyPairs.set(userId, {
        publicKey: publicKeyPem,
        privateKey: privateKeyPem,
        createdAt: Date.now()
      });

      this.logger.info('Key pair generated for user', { userId });
      
      return {
        publicKey: publicKeyPem,
        userId
      };
    } catch (error) {
      this.logger.error('Failed to generate key pair', { userId, error: error.message });
      throw error;
    }
  }

  generateSessionKey(participantIds) {
    try {
      const sessionId = crypto.randomUUID();
      const sessionKey = crypto.randomBytes(32).toString('hex');
      
      const sessionData = {
        sessionId,
        sessionKey,
        participants: participantIds,
        createdAt: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      };

      this.sessionKeys.set(sessionId, sessionData);

      this.logger.info('Session key generated', { 
        sessionId, 
        participantCount: participantIds.length 
      });

      return sessionData;
    } catch (error) {
      this.logger.error('Failed to generate session key', { error: error.message });
      throw error;
    }
  }

  encryptMessage(message, recipientPublicKey) {
    try {
      const publicKey = forge.pki.publicKeyFromPem(recipientPublicKey);
      
      const symmetricKey = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      
      const cipher = crypto.createCipher('aes-256-gcm', symmetricKey);
      let encryptedMessage = cipher.update(message, 'utf8', 'base64');
      encryptedMessage += cipher.final('base64');
      
      const authTag = cipher.getAuthTag();
      
      const encryptedSymmetricKey = publicKey.encrypt(symmetricKey.toString('base64'));
      
      const encryptedData = {
        encryptedMessage,
        encryptedKey: forge.util.encode64(encryptedSymmetricKey),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        timestamp: Date.now(),
        messageHash: this.generateMessageHash(message)
      };

      this.logger.info('Message encrypted successfully', { 
        messageHash: encryptedData.messageHash,
        timestamp: encryptedData.timestamp
      });

      return JSON.stringify(encryptedData);
    } catch (error) {
      this.logger.error('Failed to encrypt message', { error: error.message });
      throw error;
    }
  }

  decryptMessage(encryptedMessage, recipientPrivateKey) {
    try {
      const data = JSON.parse(encryptedMessage);
      const privateKey = forge.pki.privateKeyFromPem(recipientPrivateKey);
      
      const encryptedKey = forge.util.decode64(data.encryptedKey);
      const symmetricKey = privateKey.decrypt(encryptedKey);
      
      const decipher = crypto.createDecipher('aes-256-gcm', Buffer.from(symmetricKey, 'base64'));
      decipher.setAuthTag(Buffer.from(data.authTag, 'base64'));
      
      let decryptedMessage = decipher.update(data.encryptedMessage, 'base64', 'utf8');
      decryptedMessage += decipher.final('utf8');
      
      const messageHash = this.generateMessageHash(decryptedMessage);
      
      if (messageHash !== data.messageHash) {
        throw new Error('Message integrity check failed');
      }

      this.logger.info('Message decrypted successfully', { 
        messageHash,
        timestamp: data.timestamp
      });

      return {
        message: decryptedMessage,
        timestamp: data.timestamp,
        messageHash
      };
    } catch (error) {
      this.logger.error('Failed to decrypt message', { error: error.message });
      throw error;
    }
  }

  encryptGroupMessage(message, groupId, senderId) {
    try {
      const groupKey = this.groupKeys.get(groupId);
      if (!groupKey) {
        throw new Error('Group key not found');
      }

      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-gcm', groupKey.key);
      
      let encryptedMessage = cipher.update(message, 'utf8', 'base64');
      encryptedMessage += cipher.final('base64');
      
      const authTag = cipher.getAuthTag();
      
      const encryptedData = {
        encryptedMessage,
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        senderId,
        groupId,
        timestamp: Date.now(),
        messageHash: this.generateMessageHash(message)
      };

      this.logger.info('Group message encrypted successfully', { 
        groupId,
        senderId,
        messageHash: encryptedData.messageHash
      });

      return JSON.stringify(encryptedData);
    } catch (error) {
      this.logger.error('Failed to encrypt group message', { error: error.message });
      throw error;
    }
  }

  decryptGroupMessage(encryptedMessage, groupId, recipientId) {
    try {
      const data = JSON.parse(encryptedMessage);
      const groupKey = this.groupKeys.get(groupId);
      
      if (!groupKey) {
        throw new Error('Group key not found');
      }

      if (!groupKey.members.includes(recipientId)) {
        throw new Error('Recipient not authorized for this group');
      }

      const decipher = crypto.createDecipher('aes-256-gcm', groupKey.key);
      decipher.setAuthTag(Buffer.from(data.authTag, 'base64'));
      
      let decryptedMessage = decipher.update(data.encryptedMessage, 'base64', 'utf8');
      decryptedMessage += decipher.final('utf8');
      
      const messageHash = this.generateMessageHash(decryptedMessage);
      
      if (messageHash !== data.messageHash) {
        throw new Error('Message integrity check failed');
      }

      this.logger.info('Group message decrypted successfully', { 
        groupId,
        senderId: data.senderId,
        recipientId,
        messageHash
      });

      return {
        message: decryptedMessage,
        senderId: data.senderId,
        timestamp: data.timestamp,
        messageHash
      };
    } catch (error) {
      this.logger.error('Failed to decrypt group message', { error: error.message });
      throw error;
    }
  }

  createGroup(groupId, memberIds) {
    try {
      const groupKey = crypto.randomBytes(32).toString('hex');
      
      const groupData = {
        key: groupKey,
        members: memberIds,
        createdAt: Date.now(),
        createdBy: memberIds[0],
        messageCount: 0
      };

      this.groupKeys.set(groupId, groupData);

      this.logger.info('Group created successfully', { 
        groupId, 
        memberCount: memberIds.length 
      });

      return groupData;
    } catch (error) {
      this.logger.error('Failed to create group', { error: error.message });
      throw error;
    }
  }

  addGroupMember(groupId, memberId) {
    try {
      const group = this.groupKeys.get(groupId);
      if (!group) {
        throw new Error('Group not found');
      }

      if (!group.members.includes(memberId)) {
        group.members.push(memberId);
        this.logger.info('Member added to group', { groupId, memberId });
      }

      return group;
    } catch (error) {
      this.logger.error('Failed to add group member', { error: error.message });
      throw error;
    }
  }

  removeGroupMember(groupId, memberId) {
    try {
      const group = this.groupKeys.get(groupId);
      if (!group) {
        throw new Error('Group not found');
      }

      group.members = group.members.filter(id => id !== memberId);
      
      if (group.members.length === 0) {
        this.groupKeys.delete(groupId);
        this.logger.info('Group deleted - no members remaining', { groupId });
      } else {
        this.logger.info('Member removed from group', { groupId, memberId });
      }

      return group;
    } catch (error) {
      this.logger.error('Failed to remove group member', { error: error.message });
      throw error;
    }
  }

  encryptVote(voteData, voterId) {
    try {
      const voteString = JSON.stringify(voteData);
      const voterKeyPair = this.keyPairs.get(voterId);
      
      if (!voterKeyPair) {
        throw new Error('Voter key pair not found');
      }

      const encryptedVote = this.encryptMessage(voteString, voterKeyPair.publicKey);
      
      this.logger.info('Vote encrypted successfully', { 
        voterId,
        voteHash: this.generateMessageHash(voteString)
      });

      return encryptedVote;
    } catch (error) {
      this.logger.error('Failed to encrypt vote', { error: error.message });
      throw error;
    }
  }

  decryptVote(encryptedVote, voterId) {
    try {
      const voterKeyPair = this.keyPairs.get(voterId);
      
      if (!voterKeyPair) {
        throw new Error('Voter key pair not found');
      }

      const decryptedData = this.decryptMessage(encryptedVote, voterKeyPair.privateKey);
      const voteData = JSON.parse(decryptedData.message);

      this.logger.info('Vote decrypted successfully', { 
        voterId,
        voteHash: this.generateMessageHash(decryptedData.message)
      });

      return voteData;
    } catch (error) {
      this.logger.error('Failed to decrypt vote', { error: error.message });
      throw error;
    }
  }

  generateMessageHash(message) {
    return crypto.createHash('sha256').update(message).digest('hex');
  }

  verifyMessageIntegrity(message, hash) {
    const calculatedHash = this.generateMessageHash(message);
    return calculatedHash === hash;
  }

  rotateKeys(userId) {
    try {
      const oldKeyPair = this.keyPairs.get(userId);
      const newKeyPair = this.generateKeyPair(userId);

      this.logger.info('Keys rotated successfully', { 
        userId,
        oldKeyCreatedAt: oldKeyPair?.createdAt,
        newKeyCreatedAt: newKeyPair.createdAt
      });

      return newKeyPair;
    } catch (error) {
      this.logger.error('Failed to rotate keys', { userId, error: error.message });
      throw error;
    }
  }

  getPublicKey(userId) {
    const keyPair = this.keyPairs.get(userId);
    return keyPair ? keyPair.publicKey : null;
  }

  cleanupExpiredSessions() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, sessionData] of this.sessionKeys.entries()) {
      if (sessionData.expiresAt < now) {
        this.sessionKeys.delete(sessionId);
        cleanedCount++;
      }
    }

    this.logger.info('Expired sessions cleaned up', { cleanedCount });
    return cleanedCount;
  }

  getEncryptionStats() {
    return {
      activeKeyPairs: this.keyPairs.size,
      activeSessions: this.sessionKeys.size,
      activeGroups: this.groupKeys.size,
      timestamp: Date.now()
    };
  }
}

module.exports = EndToEndEncryption;