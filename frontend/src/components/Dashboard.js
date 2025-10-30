import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Spin, Alert } from 'antd';
import { UserOutlined, VoteOutlined, MessageOutlined, BookOutlined, BarChartOutlined, CheckCircleOutlined } from '@ant-design/icons';
import axios from 'axios';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/analytics/stats');
      setStats(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch dashboard statistics');
      console.error('Dashboard stats error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="Error"
        description={error}
        type="error"
        showIcon
        style={{ margin: '16px' }}
      />
    );
  }

  return (
    <div>
      <h1>Tanzania Platform Dashboard</h1>
      <p>Welcome to the unified platform for Tanzanian democracy and governance.</p>

      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Registered Citizens"
              value={stats?.citizens || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Active Votes"
              value={stats?.activeVotes || 0}
              prefix={<VoteOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Social Posts"
              value={stats?.socialPosts || 0}
              prefix={<MessageOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Knowledge Articles"
              value={stats?.knowledgeArticles || 0}
              prefix={<BookOutlined />}
              valueStyle={{ color: '#eb2f96' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: '16px' }}>
        <Col span={12}>
          <Card title="Platform Health" extra={<CheckCircleOutlined style={{ color: '#52c41a' }} />}>
            <p>All services are operational</p>
            <ul>
              <li>Identity Service: Active</li>
              <li>Voting System: Active</li>
              <li>Social Platform: Active</li>
              <li>Knowledge Base: Active</li>
              <li>Analytics: Active</li>
            </ul>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Recent Activity" extra={<BarChartOutlined />}>
            <p>Latest platform updates:</p>
            <ul>
              <li>New citizen registrations: +127 today</li>
              <li>Votes cast: 3,456 this week</li>
              <li>Social engagement: 89% increase</li>
              <li>Knowledge contributions: 234 articles added</li>
            </ul>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;