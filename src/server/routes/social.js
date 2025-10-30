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

// Post Management Routes

// Create new post
router.post('/posts', authenticateToken, asyncHandler(async (req, res) => {
  const { content, media, communityId, tags, isAnonymous, language } = req.body;
  const authorId = req.user.id;

  // Validate required fields
  if (!content || content.trim().length === 0) {
    return res.status(400).json({
      error: 'Post content is required'
    });
  }

  // AI-powered content moderation
  const moderationResult = await singularityNET.executeWorkflow({
    type: 'content-moderation',
    data: {
      content,
      authorId,
      communityId,
      language: language || 'sw' // Default to Swahili
    },
    context: { sensitivity: 'high' }
  });

  if (moderationResult.decision === 'block') {
    return res.status(403).json({
      error: 'Content violates community guidelines',
      reason: moderationResult.reason,
      categories: moderationResult.categories
    });
  }

  // Cultural context analysis with MeTTa
  const culturalAnalysis = await mettaRuntime.analyzeSentiment(
    content,
    { language, communityId, authorId }
  );

  // Create post object
  const post = {
    postId: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    authorId,
    content,
    media: media || [],
    communityId,
    tags: tags || [],
    isAnonymous: isAnonymous || false,
    language: language || 'sw',
    moderationStatus: moderationResult.decision,
    culturalContext: culturalAnalysis,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    likes: 0,
    comments: 0,
    shares: 0,
    status: 'active'
  };

  // Store post in consensus (simulated)
  const consensusResult = await consensusService.submitMessage({
    type: 'social-post',
    post: encryptionService.encryptVote(JSON.stringify(post), authorId)
  });

  res.status(201).json({
    message: 'Post created successfully',
    post: {
      ...post,
      consensusTransactionId: consensusResult.transactionId,
      moderationResult: {
        status: moderationResult.decision,
        confidence: moderationResult.confidence
      }
    }
  });
}));

// Get posts feed
router.get('/posts', authenticateToken, asyncHandler(async (req, res) => {
  const {
    communityId,
    authorId,
    tags,
    language,
    sortBy = 'recent',
    page = 1,
    limit = 20
  } = req.query;

  const userId = req.user.id;

  // Build filter criteria
  const filters = {};
  if (communityId) filters.communityId = communityId;
  if (authorId) filters.authorId = authorId;
  if (tags) filters.tags = tags.split(',');
  if (language) filters.language = language;

  // AI-powered content recommendation
  const recommendations = await singularityNET.executeWorkflow({
    type: 'content-recommendation',
    data: {
      userId,
      filters,
      preferences: req.user.preferences || {}
    },
    context: { feedType: 'social' }
  });

  // Simulate fetching posts (in production, this would query database)
  const posts = await generateMockPosts(filters, sortBy, page, limit, recommendations);

  res.json({
    posts,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: posts.length * 5, // Simulated total
      hasMore: posts.length === limit
    },
    recommendations: recommendations.suggestions || []
  });
}));

// Get specific post
router.get('/posts/:postId', authenticateToken, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.id;

  // Simulate fetching post
  const post = await getMockPost(postId);

  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  // Check if user can view this post (community access, etc.)
  if (post.communityId && !await checkCommunityAccess(userId, post.communityId)) {
    return res.status(403).json({ error: 'Access denied to this community' });
  }

  res.json({
    post: {
      ...post,
      canEdit: post.authorId === userId,
      canDelete: post.authorId === userId,
      userReaction: await getUserReaction(userId, postId)
    }
  });
}));

// Update post
router.put('/posts/:postId', authenticateToken, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { content, media, tags } = req.body;
  const userId = req.user.id;

  const post = await getMockPost(postId);

  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  if (post.authorId !== userId) {
    return res.status(403).json({ error: 'You can only edit your own posts' });
  }

  // Re-moderate updated content
  const moderationResult = await singularityNET.executeWorkflow({
    type: 'content-moderation',
    data: { content, authorId: userId },
    context: { isUpdate: true }
  });

  if (moderationResult.decision === 'block') {
    return res.status(403).json({
      error: 'Updated content violates community guidelines'
    });
  }

  // Update post
  const updatedPost = {
    ...post,
    content: content || post.content,
    media: media || post.media,
    tags: tags || post.tags,
    updatedAt: new Date().toISOString(),
    moderationStatus: moderationResult.decision
  };

  res.json({
    message: 'Post updated successfully',
    post: updatedPost
  });
}));

// Delete post
router.delete('/posts/:postId', authenticateToken, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.id;

  const post = await getMockPost(postId);

  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  if (post.authorId !== userId) {
    return res.status(403).json({ error: 'You can only delete your own posts' });
  }

  // Mark as deleted (soft delete)
  post.status = 'deleted';
  post.deletedAt = new Date().toISOString();

  res.json({
    message: 'Post deleted successfully'
  });
}));

// Comments and Interactions

// Add comment to post
router.post('/posts/:postId/comments', authenticateToken, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { content, parentCommentId } = req.body;
  const authorId = req.user.id;

  const post = await getMockPost(postId);
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  // Moderate comment
  const moderationResult = await singularityNET.executeWorkflow({
    type: 'content-moderation',
    data: { content, authorId, context: 'comment' },
    context: { sensitivity: 'medium' }
  });

  if (moderationResult.decision === 'block') {
    return res.status(403).json({
      error: 'Comment violates community guidelines'
    });
  }

  const comment = {
    commentId: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    postId,
    authorId,
    content,
    parentCommentId,
    moderationStatus: moderationResult.decision,
    createdAt: new Date().toISOString(),
    likes: 0,
    replies: 0
  };

  // Update post comment count
  post.comments += 1;

  res.status(201).json({
    message: 'Comment added successfully',
    comment
  });
}));

// Get comments for post
router.get('/posts/:postId/comments', authenticateToken, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const post = await getMockPost(postId);
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  // Simulate fetching comments
  const comments = await generateMockComments(postId, page, limit);

  res.json({
    comments,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: comments.length * 3, // Simulated total
      hasMore: comments.length === limit
    }
  });
}));

// Like/Unlike post
router.post('/posts/:postId/like', authenticateToken, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { reaction = 'like' } = req.body;
  const userId = req.user.id;

  const post = await getMockPost(postId);
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const existingReaction = await getUserReaction(userId, postId);

  if (existingReaction) {
    // Remove reaction
    post.likes -= 1;
    await removeUserReaction(userId, postId);
    res.json({
      message: 'Reaction removed',
      liked: false,
      likes: post.likes
    });
  } else {
    // Add reaction
    post.likes += 1;
    await addUserReaction(userId, postId, reaction);
    res.json({
      message: 'Post liked',
      liked: true,
      likes: post.likes
    });
  }
}));

// Share post
router.post('/posts/:postId/share', authenticateToken, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { shareType = 'reshare', message } = req.body;
  const userId = req.user.id;

  const post = await getMockPost(postId);
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  // Create share record
  const share = {
    shareId: `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    postId,
    userId,
    shareType,
    message,
    createdAt: new Date().toISOString()
  };

  post.shares += 1;

  res.json({
    message: 'Post shared successfully',
    share,
    shares: post.shares
  });
}));

// Community Management Routes

// Create community
router.post('/communities', authenticateToken, authorizeRoles(['admin', 'moderator']), asyncHandler(async (req, res) => {
  const { name, description, category, rules, isPrivate, language } = req.body;
  const creatorId = req.user.id;

  // Validate required fields
  if (!name || !description) {
    return res.status(400).json({
      error: 'Community name and description are required'
    });
  }

  const community = {
    communityId: `community_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    description,
    category: category || 'general',
    rules: rules || [],
    isPrivate: isPrivate || false,
    language: language || 'sw',
    creatorId,
    moderators: [creatorId],
    members: [creatorId],
    memberCount: 1,
    createdAt: new Date().toISOString(),
    status: 'active'
  };

  res.status(201).json({
    message: 'Community created successfully',
    community
  });
}));

// Get communities
router.get('/communities', asyncHandler(async (req, res) => {
  const { category, language, search, page = 1, limit = 20 } = req.query;

  // Simulate fetching communities
  const communities = await generateMockCommunities(category, language, search, page, limit);

  res.json({
    communities,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: communities.length * 4,
      hasMore: communities.length === limit
    }
  });
}));

// Join/Leave community
router.post('/communities/:communityId/join', authenticateToken, asyncHandler(async (req, res) => {
  const { communityId } = req.params;
  const userId = req.user.id;

  const community = await getMockCommunity(communityId);
  if (!community) {
    return res.status(404).json({ error: 'Community not found' });
  }

  if (community.members.includes(userId)) {
    // Leave community
    community.members = community.members.filter(id => id !== userId);
    community.memberCount -= 1;
    res.json({
      message: 'Left community successfully',
      joined: false,
      memberCount: community.memberCount
    });
  } else {
    // Join community
    if (community.isPrivate) {
      return res.status(403).json({
        error: 'This is a private community. Request membership first.'
      });
    }

    community.members.push(userId);
    community.memberCount += 1;
    res.json({
      message: 'Joined community successfully',
      joined: true,
      memberCount: community.memberCount
    });
  }
}));

// User Profile Routes

// Get user profile
router.get('/users/:userId/profile', authenticateToken, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user.id;

  // Simulate fetching user profile
  const profile = await getMockUserProfile(userId);

  if (!profile) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Add relationship info for current user
  const relationship = await getUserRelationship(currentUserId, userId);

  res.json({
    profile: {
      ...profile,
      ...relationship,
      isOwnProfile: currentUserId === userId
    }
  });
}));

// Update user profile
router.put('/users/profile', authenticateToken, asyncHandler(async (req, res) => {
  const { displayName, bio, avatar, location, interests, languages } = req.body;
  const userId = req.user.id;

  const profile = await getMockUserProfile(userId);

  const updatedProfile = {
    ...profile,
    displayName: displayName || profile.displayName,
    bio: bio || profile.bio,
    avatar: avatar || profile.avatar,
    location: location || profile.location,
    interests: interests || profile.interests,
    languages: languages || profile.languages,
    updatedAt: new Date().toISOString()
  };

  res.json({
    message: 'Profile updated successfully',
    profile: updatedProfile
  });
}));

// Follow/Unfollow user
router.post('/users/:userId/follow', authenticateToken, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user.id;

  if (userId === currentUserId) {
    return res.status(400).json({ error: 'Cannot follow yourself' });
  }

  const targetProfile = await getMockUserProfile(userId);
  const currentProfile = await getMockUserProfile(currentUserId);

  if (!targetProfile) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (currentProfile.following.includes(userId)) {
    // Unfollow
    currentProfile.following = currentProfile.following.filter(id => id !== userId);
    targetProfile.followers = targetProfile.followers.filter(id => id !== currentUserId);
    currentProfile.followingCount -= 1;
    targetProfile.followersCount -= 1;

    res.json({
      message: 'Unfollowed user successfully',
      following: false,
      followingCount: currentProfile.followingCount,
      followersCount: targetProfile.followersCount
    });
  } else {
    // Follow
    currentProfile.following.push(userId);
    targetProfile.followers.push(currentUserId);
    currentProfile.followingCount += 1;
    targetProfile.followersCount += 1;

    res.json({
      message: 'Following user successfully',
      following: true,
      followingCount: currentProfile.followingCount,
      followersCount: targetProfile.followersCount
    });
  }
}));

// Analytics and Moderation Routes

// Get social analytics (Admin/Moderator)
router.get('/analytics/social', authenticateToken, authorizeRoles(['admin', 'moderator']), asyncHandler(async (req, res) => {
  const { communityId, startDate, endDate } = req.query;

  // Use AI for social analytics
  const analytics = await singularityNET.executeWorkflow({
    type: 'social-analytics',
    data: {
      communityId,
      startDate: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: endDate ? new Date(endDate) : new Date()
    },
    context: { depth: 'comprehensive' }
  });

  res.json({
    message: 'Social analytics retrieved successfully',
    analytics: {
      engagement: analytics.engagement || {},
      sentiment: analytics.sentiment || {},
      trends: analytics.trends || [],
      moderation: analytics.moderation || {}
    }
  });
}));

// Report content (Users)
router.post('/reports', authenticateToken, asyncHandler(async (req, res) => {
  const { contentId, contentType, reason, description } = req.body;
  const reporterId = req.user.id;

  // Validate required fields
  if (!contentId || !contentType || !reason) {
    return res.status(400).json({
      error: 'Content ID, type, and reason are required'
    });
  }

  // AI-powered report analysis
  const analysis = await singularityNET.executeWorkflow({
    type: 'report-analysis',
    data: {
      contentId,
      contentType,
      reason,
      description,
      reporterId
    },
    context: { priority: 'high' }
  });

  const report = {
    reportId: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    contentId,
    contentType,
    reporterId,
    reason,
    description,
    priority: analysis.priority || 'medium',
    aiAnalysis: analysis.result,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  res.status(201).json({
    message: 'Report submitted successfully',
    report: {
      reportId: report.reportId,
      status: report.status,
      priority: report.priority
    }
  });
}));

// Get reports (Moderators)
router.get('/reports', authenticateToken, authorizeRoles(['moderator', 'admin']), asyncHandler(async (req, res) => {
  const { status = 'pending', page = 1, limit = 20 } = req.query;

  // Simulate fetching reports
  const reports = await generateMockReports(status, page, limit);

  res.json({
    reports,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: reports.length * 5,
      hasMore: reports.length === limit
    }
  });
}));

// Moderate content (Moderators)
router.post('/moderate/:contentId', authenticateToken, authorizeRoles(['moderator', 'admin']), asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { action, reason, contentType } = req.body;
  const moderatorId = req.user.id;

  // Validate action
  const validActions = ['approve', 'remove', 'warn', 'ban'];
  if (!validActions.includes(action)) {
    return res.status(400).json({
      error: 'Invalid moderation action'
    });
  }

  const moderation = {
    moderationId: `mod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    contentId,
    contentType,
    moderatorId,
    action,
    reason,
    timestamp: new Date().toISOString()
  };

  res.json({
    message: `Content ${action}d successfully`,
    moderation
  });
}));

// Mock data generation functions (replace with actual database queries)
async function generateMockPosts(filters, sortBy, page, limit, recommendations) {
  const posts = [];
  for (let i = 0; i < limit; i++) {
    posts.push({
      postId: `post_${page}_${i}`,
      authorId: `user_${Math.floor(Math.random() * 100)}`,
      content: `Sample post content ${i} in ${filters.language || 'Swahili'}`,
      communityId: filters.communityId || 'general',
      tags: ['sample', 'tanzania'],
      language: filters.language || 'sw',
      createdAt: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      likes: Math.floor(Math.random() * 100),
      comments: Math.floor(Math.random() * 20),
      shares: Math.floor(Math.random() * 10),
      moderationStatus: 'approved'
    });
  }
  return posts;
}

async function getMockPost(postId) {
  return {
    postId,
    authorId: 'user_123',
    content: 'Sample post content',
    communityId: 'general',
    tags: ['sample'],
    language: 'sw',
    createdAt: new Date().toISOString(),
    likes: 42,
    comments: 8,
    shares: 3,
    status: 'active'
  };
}

async function generateMockComments(postId, page, limit) {
  const comments = [];
  for (let i = 0; i < limit; i++) {
    comments.push({
      commentId: `comment_${postId}_${i}`,
      postId,
      authorId: `user_${Math.floor(Math.random() * 100)}`,
      content: `Sample comment ${i}`,
      createdAt: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      likes: Math.floor(Math.random() * 10),
      replies: Math.floor(Math.random() * 3)
    });
  }
  return comments;
}

async function getUserReaction(userId, postId) {
  return Math.random() > 0.7 ? 'like' : null;
}

async function addUserReaction(userId, postId, reaction) {
  // Mock implementation
  return true;
}

async function removeUserReaction(userId, postId) {
  // Mock implementation
  return true;
}

async function checkCommunityAccess(userId, communityId) {
  return true; // Mock implementation
}

async function generateMockCommunities(category, language, search, page, limit) {
  const communities = [];
  for (let i = 0; i < limit; i++) {
    communities.push({
      communityId: `community_${page}_${i}`,
      name: `Community ${i}`,
      description: `Description for community ${i}`,
      category: category || 'general',
      language: language || 'sw',
      memberCount: Math.floor(Math.random() * 1000),
      isPrivate: Math.random() > 0.8,
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
    });
  }
  return communities;
}

async function getMockCommunity(communityId) {
  return {
    communityId,
    name: 'Sample Community',
    description: 'A sample community',
    members: ['user_1', 'user_2'],
    memberCount: 2,
    isPrivate: false
  };
}

async function getMockUserProfile(userId) {
  return {
    userId,
    displayName: `User ${userId}`,
    bio: 'Sample user bio',
    avatar: null,
    location: 'Tanzania',
    interests: ['technology', 'community'],
    languages: ['sw', 'en'],
    followers: [],
    following: [],
    followersCount: Math.floor(Math.random() * 100),
    followingCount: Math.floor(Math.random() * 100),
    postsCount: Math.floor(Math.random() * 50),
    joinedAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
  };
}

async function getUserRelationship(userId, targetUserId) {
  return {
    isFollowing: Math.random() > 0.5,
    isFollowedBy: Math.random() > 0.5,
    isBlocked: false
  };
}

async function generateMockReports(status, page, limit) {
  const reports = [];
  for (let i = 0; i < limit; i++) {
    reports.push({
      reportId: `report_${page}_${i}`,
      contentId: `content_${i}`,
      contentType: 'post',
      reporterId: `user_${Math.floor(Math.random() * 100)}`,
      reason: 'spam',
      description: 'This post appears to be spam',
      priority: Math.random() > 0.7 ? 'high' : 'medium',
      status: status,
      createdAt: new Date(Date.now() - Math.random() * 86400000).toISOString()
    });
  }
  return reports;
}

module.exports = { router, initializeServices };