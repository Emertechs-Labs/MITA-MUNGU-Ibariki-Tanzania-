import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, List, Avatar, Comment, Tooltip, Modal, message, Spin, Alert, Tabs } from 'antd';
import { MessageOutlined, LikeOutlined, DislikeOutlined, UserOutlined, SendOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const { TextArea } = Input;
const { TabPane } = Tabs;

const Social = () => {
  const [form] = Form.useForm();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [postsLoading, setPostsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    fetchPosts();
    setupWebSocket();
    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  const fetchPosts = async () => {
    try {
      setPostsLoading(true);
      const response = await axios.get('/api/social/posts');
      setPosts(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch posts');
      console.error('Fetch posts error:', err);
    } finally {
      setPostsLoading(false);
    }
  };

  const setupWebSocket = () => {
    // WebSocket connection would be established here
    // For now, we'll use polling for simplicity
    const interval = setInterval(fetchPosts, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  };

  const handleCreatePost = async (values) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/social/posts', {
        content: values.content,
        type: 'text'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success('Post created successfully!');
      form.resetFields();
      fetchPosts();
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create post');
      message.error('Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/social/posts/${postId}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchPosts();
    } catch (err) {
      message.error('Failed to like post');
    }
  };

  const handleComment = async (postId, comment) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/social/posts/${postId}/comments`, {
        content: comment
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchPosts();
    } catch (err) {
      message.error('Failed to add comment');
    }
  };

  const actions = (post) => [
    <Tooltip key="like" title="Like">
      <span onClick={() => handleLike(post.id)}>
        <LikeOutlined />
        <span style={{ paddingLeft: 8 }}>{post.likes || 0}</span>
      </span>
    </Tooltip>,
    <Tooltip key="comment" title="Comment">
      <MessageOutlined />
      <span style={{ paddingLeft: 8 }}>{post.comments?.length || 0}</span>
    </Tooltip>,
  ];

  return (
    <div>
      <h1>Social Platform</h1>
      <p>Connect with fellow Tanzanians, share ideas, and engage in community discussions.</p>

      {error && (
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: '16px' }}
        />
      )}

      <Tabs defaultActiveKey="1">
        <TabPane tab="Create Post" key="1">
          <Card title="Share Your Thoughts" extra={<SendOutlined />}>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleCreatePost}
            >
              <Form.Item
                name="content"
                label="What's on your mind?"
                rules={[{ required: true, message: 'Please enter your post content' }]}
              >
                <TextArea
                  placeholder="Share your thoughts with the community..."
                  rows={4}
                  showCount
                  maxLength={500}
                />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} block>
                  Post
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>

        <TabPane tab="Community Feed" key="2">
          <Card title="Community Posts" extra={<MessageOutlined />}>
            {postsLoading ? (
              <div style={{ textAlign: 'center', padding: '50px' }}>
                <Spin size="large" />
                <p>Loading posts...</p>
              </div>
            ) : (
              <List
                dataSource={posts}
                renderItem={post => (
                  <Comment
                    actions={actions(post)}
                    author={<strong>{post.author?.name || 'Anonymous'}</strong>}
                    avatar={<Avatar icon={<UserOutlined />} />}
                    content={<p>{post.content}</p>}
                    datetime={
                      <Tooltip title={moment(post.createdAt).format('YYYY-MM-DD HH:mm:ss')}>
                        <span>{moment(post.createdAt).fromNow()}</span>
                      </Tooltip>
                    }
                  >
                    {post.comments && post.comments.length > 0 && (
                      <List
                        dataSource={post.comments}
                        renderItem={comment => (
                          <Comment
                            author={<strong>{comment.author?.name || 'Anonymous'}</strong>}
                            avatar={<Avatar size="small" icon={<UserOutlined />} />}
                            content={<p>{comment.content}</p>}
                            datetime={
                              <Tooltip title={moment(comment.createdAt).format('YYYY-MM-DD HH:mm:ss')}>
                                <span>{moment(comment.createdAt).fromNow()}</span>
                              </Tooltip>
                            }
                          />
                        )}
                      />
                    )}
                  </Comment>
                )}
              />
            )}
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default Social;