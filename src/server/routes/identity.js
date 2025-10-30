const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const {
  asyncHandler,
  ValidationError,
  UnauthorizedError,
  NotFoundError,
  ConflictError
} = require('../middleware/errorHandler');
const {
  authenticateToken,
  verifyBiometric,
  sensitiveOperationLimiter,
  auditLog
} = require('../middleware/auth');
const { auditLogger, securityLogger } = require('../middleware/logging');

const router = express.Router();

// In-memory storage for demo purposes (replace with database in production)
const users = new Map();
const dids = new Map();
const biometricTokens = new Map();

// DID (Decentralized Identifier) Service
class DIDService {
  constructor() {
    this.consensusService = null; // Will be injected
  }

  setConsensusService(service) {
    this.consensusService = service;
  }

  async createDID(userData) {
    const did = `did:tanzania:${uuidv4()}`;
    const didDocument = {
      '@context': 'https://www.w3.org/ns/did/v1',
      id: did,
      created: new Date().toISOString(),
      verificationMethod: [{
        id: `${did}#key-1`,
        type: 'Ed25519VerificationKey2020',
        controller: did,
        publicKeyMultibase: this.generatePublicKey()
      }],
      authentication: [`${did}#key-1`],
      service: [{
        id: `${did}#service-1`,
        type: 'LinkedDomains',
        serviceEndpoint: 'https://platform.tanzania.gov.tz'
      }],
      // Tanzania-specific extensions
      tanzaniaCitizen: {
        nationalId: userData.nationalId,
        region: userData.region,
        registrationDate: new Date().toISOString(),
        status: 'active'
      }
    };

    // Anchor DID on Hedera consensus
    if (this.consensusService) {
      const consensusMessage = {
        type: 'DID_CREATION',
        did,
        document: didDocument,
        timestamp: new Date().toISOString()
      };

      await this.consensusService.submitConsensusMessage(
        'did-topic',
        JSON.stringify(consensusMessage)
      );
    }

    return { did, document: didDocument };
  }

  async resolveDID(did) {
    // In production, resolve from Hedera consensus or DID registry
    return dids.get(did);
  }

  async updateDID(did, updates) {
    const existingDoc = await this.resolveDID(did);
    if (!existingDoc) {
      throw new NotFoundError('DID not found');
    }

    const updatedDoc = {
      ...existingDoc,
      ...updates,
      updated: new Date().toISOString()
    };

    // Anchor update on Hedera
    if (this.consensusService) {
      const consensusMessage = {
        type: 'DID_UPDATE',
        did,
        updates,
        timestamp: new Date().toISOString()
      };

      await this.consensusService.submitConsensusMessage(
        'did-topic',
        JSON.stringify(consensusMessage)
      );
    }

    dids.set(did, updatedDoc);
    return updatedDoc;
  }

  generatePublicKey() {
    // Generate a mock public key (in production, use proper crypto)
    return crypto.randomBytes(32).toString('base64');
  }
}

// Biometric Verification Service
class BiometricService {
  constructor() {
    this.encryptionService = null; // Will be injected
  }

  setEncryptionService(service) {
    this.encryptionService = service;
  }

  async enrollBiometric(userId, biometricData) {
    // In production, this would:
    // 1. Extract biometric features (face, fingerprint, etc.)
    // 2. Generate biometric template
    // 3. Store encrypted template securely

    const biometricToken = uuidv4();
    const encryptedTemplate = await this.encryptionService.encryptData(
      JSON.stringify(biometricData.template)
    );

    biometricTokens.set(biometricToken, {
      userId,
      template: encryptedTemplate,
      enrolledAt: new Date().toISOString(),
      status: 'active'
    });

    return { biometricToken, enrolledAt: new Date().toISOString() };
  }

  async verifyBiometric(biometricToken, verificationData) {
    const storedData = biometricTokens.get(biometricToken);
    if (!storedData || storedData.status !== 'active') {
      throw new UnauthorizedError('Invalid or expired biometric token');
    }

    // In production, perform actual biometric matching
    // For demo, simulate verification with high confidence
    const confidence = Math.random() * 0.3 + 0.7; // 70-100% confidence

    if (confidence < 0.8) {
      throw new UnauthorizedError('Biometric verification failed');
    }

    return {
      verified: true,
      confidence,
      userId: storedData.userId,
      verifiedAt: new Date().toISOString()
    };
  }

  async revokeBiometric(biometricToken) {
    const storedData = biometricTokens.get(biometricToken);
    if (!storedData) {
      throw new NotFoundError('Biometric token not found');
    }

    storedData.status = 'revoked';
    storedData.revokedAt = new Date().toISOString();

    biometricTokens.set(biometricToken, storedData);
    return { revoked: true, revokedAt: storedData.revokedAt };
  }
}

// Initialize services
const didService = new DIDService();
const biometricService = new BiometricService();

// Inject dependencies (will be set by main server)
let consensusService = null;
let encryptionService = null;

const setServices = (services) => {
  consensusService = services.consensus;
  encryptionService = services.encryption;

  didService.setConsensusService(consensusService);
  biometricService.setEncryptionService(encryptionService);
};

// Validation helpers
const validateRegistrationData = (data) => {
  const required = ['nationalId', 'fullName', 'dateOfBirth', 'region', 'phoneNumber'];
  const missing = required.filter(field => !data[field]);

  if (missing.length > 0) {
    throw new ValidationError(`Missing required fields: ${missing.join(', ')}`);
  }

  // Validate national ID format (Tanzanian format)
  if (!/^(\d{8}-\d{5}-\d{5}-\d{2})$/.test(data.nationalId)) {
    throw new ValidationError('Invalid national ID format. Expected: XXXXXXXX-XXXXX-XXXXX-XX');
  }

  // Validate phone number (Tanzanian format)
  if (!/^(\+255|0)[67]\d{8}$/.test(data.phoneNumber)) {
    throw new ValidationError('Invalid phone number format');
  }
};

// Routes

// POST /api/v1/identity/register
// Register a new citizen with DID creation
router.post('/register', asyncHandler(async (req, res) => {
  const { nationalId, fullName, dateOfBirth, region, phoneNumber, email, biometricData } = req.body;

  // Validate input data
  validateRegistrationData({ nationalId, fullName, dateOfBirth, region, phoneNumber });

  // Check if user already exists
  const existingUser = Array.from(users.values()).find(u => u.nationalId === nationalId);
  if (existingUser) {
    throw new ConflictError('User with this national ID already exists');
  }

  // Create user record
  const userId = uuidv4();
  const user = {
    id: userId,
    nationalId,
    fullName,
    dateOfBirth,
    region,
    phoneNumber,
    email,
    status: 'pending_verification',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  users.set(userId, user);

  // Create DID for the user
  const { did, document } = await didService.createDID(user);
  user.did = did;
  dids.set(did, document);

  // If biometric data provided, enroll it
  let biometricResult = null;
  if (biometricData) {
    biometricResult = await biometricService.enrollBiometric(userId, biometricData);
    user.biometricEnrolled = true;
  }

  // Audit log
  auditLogger.logUserAction(userId, 'REGISTER', 'identity', { did, region });

  res.status(201).json({
    message: 'Registration initiated successfully',
    userId,
    did,
    status: 'pending_verification',
    biometricEnrolled: !!biometricResult,
    nextSteps: [
      'Complete biometric verification',
      'Verify phone number',
      'Confirm email address'
    ]
  });
}));

// POST /api/v1/identity/verify-biometric
// Enroll or verify biometric data
router.post('/verify-biometric', authenticateToken, asyncHandler(async (req, res) => {
  const { userId, biometricData, action = 'enroll' } = req.body;

  // Verify user owns this identity
  if (req.user.id !== userId) {
    throw new UnauthorizedError('Cannot modify biometric data for another user');
  }

  let result;
  if (action === 'enroll') {
    result = await biometricService.enrollBiometric(userId, biometricData);
  } else if (action === 'verify') {
    const { biometricToken } = req.body;
    result = await biometricService.verifyBiometric(biometricToken, biometricData);
  } else {
    throw new ValidationError('Invalid action. Must be "enroll" or "verify"');
  }

  // Update user status if verification successful
  if (action === 'verify' && result.verified) {
    const user = users.get(userId);
    if (user) {
      user.status = 'verified';
      user.verifiedAt = new Date().toISOString();
      users.set(userId, user);
    }
  }

  auditLogger.logUserAction(userId, 'BIOMETRIC_VERIFICATION', 'identity', { action, success: result.verified });

  res.json({
    message: action === 'enroll' ? 'Biometric data enrolled successfully' : 'Biometric verification completed',
    ...result
  });
}));

// GET /api/v1/identity/did/:did
// Resolve a DID document
router.get('/did/:did', asyncHandler(async (req, res) => {
  const { did } = req.params;

  const document = await didService.resolveDID(did);
  if (!document) {
    throw new NotFoundError('DID not found');
  }

  res.json(document);
}));

// PUT /api/v1/identity/did/:did
// Update a DID document (requires authentication)
router.put('/did/:did', authenticateToken, asyncHandler(async (req, res) => {
  const { did } = req.params;
  const updates = req.body;

  // Verify ownership
  const user = users.get(req.user.id);
  if (!user || user.did !== did) {
    throw new UnauthorizedError('You do not own this DID');
  }

  const updatedDocument = await didService.updateDID(did, updates);

  auditLogger.logUserAction(req.user.id, 'DID_UPDATE', 'identity', { did });

  res.json({
    message: 'DID updated successfully',
    document: updatedDocument
  });
}));

// POST /api/v1/identity/authenticate
// Authenticate user with multiple factors
router.post('/authenticate', asyncHandler(async (req, res) => {
  const { identifier, password, biometricToken, mfaCode } = req.body;

  // Find user by national ID or phone number
  const user = Array.from(users.values()).find(u =>
    u.nationalId === identifier || u.phoneNumber === identifier
  );

  if (!user) {
    securityLogger.logFailedLogin(identifier, req.ip, 'user_not_found');
    throw new UnauthorizedError('Invalid credentials');
  }

  // Basic password check (in production, use proper hashing)
  if (password && user.password !== password) {
    securityLogger.logFailedLogin(identifier, req.ip, 'invalid_password');
    throw new UnauthorizedError('Invalid credentials');
  }

  // Biometric verification if token provided
  if (biometricToken) {
    try {
      await biometricService.verifyBiometric(biometricToken, {});
    } catch (error) {
      securityLogger.logFailedLogin(identifier, req.ip, 'biometric_failed');
      throw new UnauthorizedError('Biometric verification failed');
    }
  }

  // MFA verification (placeholder)
  if (mfaCode && user.mfaSecret) {
    // In production, verify TOTP code
    if (mfaCode !== '123456') { // Demo code
      throw new UnauthorizedError('Invalid MFA code');
    }
  }

  // Generate JWT token
  const token = jwt.sign(
    {
      id: user.id,
      did: user.did,
      roles: user.roles || ['citizen'],
      region: user.region
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  auditLogger.logUserAction(user.id, 'AUTHENTICATE', 'identity', { method: 'multi-factor' });

  res.json({
    message: 'Authentication successful',
    token,
    user: {
      id: user.id,
      did: user.did,
      fullName: user.fullName,
      region: user.region,
      status: user.status
    },
    expiresIn: '24h'
  });
}));

// GET /api/v1/identity/profile
// Get user profile (requires authentication)
router.get('/profile', authenticateToken, asyncHandler(async (req, res) => {
  const user = users.get(req.user.id);

  if (!user) {
    throw new NotFoundError('User profile not found');
  }

  res.json({
    id: user.id,
    did: user.did,
    nationalId: user.nationalId,
    fullName: user.fullName,
    dateOfBirth: user.dateOfBirth,
    region: user.region,
    phoneNumber: user.phoneNumber,
    email: user.email,
    status: user.status,
    biometricEnrolled: user.biometricEnrolled,
    createdAt: user.createdAt,
    verifiedAt: user.verifiedAt
  });
}));

// PUT /api/v1/identity/profile
// Update user profile (requires authentication)
router.put('/profile', authenticateToken, asyncHandler(async (req, res) => {
  const user = users.get(req.user.id);

  if (!user) {
    throw new NotFoundError('User profile not found');
  }

  const allowedUpdates = ['fullName', 'email', 'phoneNumber'];
  const updates = {};

  for (const field of allowedUpdates) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  Object.assign(user, updates, { updatedAt: new Date().toISOString() });
  users.set(req.user.id, user);

  auditLogger.logUserAction(req.user.id, 'PROFILE_UPDATE', 'identity', { fields: Object.keys(updates) });

  res.json({
    message: 'Profile updated successfully',
    user: {
      id: user.id,
      did: user.did,
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      updatedAt: user.updatedAt
    }
  });
}));

// POST /api/v1/identity/revoke-biometric
// Revoke biometric enrollment (requires authentication)
router.post('/revoke-biometric', authenticateToken, sensitiveOperationLimiter, asyncHandler(async (req, res) => {
  const { biometricToken } = req.body;

  const result = await biometricService.revokeBiometric(biometricToken);

  auditLogger.logUserAction(req.user.id, 'BIOMETRIC_REVOKE', 'identity', { biometricToken });

  res.json({
    message: 'Biometric enrollment revoked successfully',
    ...result
  });
}));

module.exports = {
  router,
  setServices,
  didService,
  biometricService
};