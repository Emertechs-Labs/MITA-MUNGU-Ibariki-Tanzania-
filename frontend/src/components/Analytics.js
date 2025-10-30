import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Spin, Alert, Tabs, Select, DatePicker } from 'antd';
import { BarChartOutlined, LineChartOutlined, PieChartOutlined, UserOutlined, VoteOutlined, MessageOutlined, BookOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const { TabPane } = Tabs;
const { Option } = Select;
const { RangePicker } = DatePicker;

const Analytics = () => {
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState([moment().subtract(30, 'days'), moment()]);
  const [selectedMetric, setSelectedMetric] = useState('users');

  useEffect(() => {
    fetchStats();
    fetchAnalytics();
  }, [dateRange, selectedMetric]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/analytics/stats');
      setStats(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch statistics');
      console.error('Fetch stats error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      const response = await axios.get('/api/analytics/data', {
        params: {
          metric: selectedMetric,
          startDate: dateRange[0].format('YYYY-MM-DD'),
          endDate: dateRange[1].format('YYYY-MM-DD')
        }
      });
      setAnalytics(response.data);
    } catch (err) {
      console.error('Fetch analytics error:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const analyticsColumns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (date) => moment(date).format('YYYY-MM-DD'),
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
    },
    {
      title: 'Change',
      dataIndex: 'change',
      key: 'change',
      render: (change) => (
        <span style={{ color: change > 0 ? '#52c41a' : change < 0 ? '#ff4d4f' : '#666' }}>
          {change > 0 ? '+' : ''}{change}%
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <p>Loading analytics...</p>
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
      <h1>Platform Analytics</h1>
      <p>Monitor platform usage, engagement, and performance metrics.</p>

      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Users"
              value={stats?.totalUsers || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Active Elections"
              value={stats?.activeElections || 0}
              prefix={<VoteOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Social Posts"
              value={stats?.totalPosts || 0}
              prefix={<MessageOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Knowledge Articles"
              value={stats?.totalArticles || 0}
              prefix={<BookOutlined />}
              valueStyle={{ color: '#eb2f96' }}
            />
          </Card>
        </Col>
      </Row>

      <Tabs defaultActiveKey="1">
        <TabPane tab="Overview" key="1">
          <Row gutter={16}>
            <Col span={12}>
              <Card title="User Engagement" extra={<BarChartOutlined />}>
                <p><strong>Daily Active Users:</strong> {stats?.dailyActiveUsers || 0}</p>
                <p><strong>Weekly Active Users:</strong> {stats?.weeklyActiveUsers || 0}</p>
                <p><strong>Monthly Active Users:</strong> {stats?.monthlyActiveUsers || 0}</p>
                <p><strong>User Retention Rate:</strong> {stats?.retentionRate || 0}%</p>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="Content Metrics" extra={<LineChartOutlined />}>
                <p><strong>Posts Created Today:</strong> {stats?.postsToday || 0}</p>
                <p><strong>Articles Published This Week:</strong> {stats?.articlesThisWeek || 0}</p>
                <p><strong>Votes Cast This Month:</strong> {stats?.votesThisMonth || 0}</p>
                <p><strong>Comments This Week:</strong> {stats?.commentsThisWeek || 0}</p>
              </Card>
            </Col>
          </Row>

          <Row gutter={16} style={{ marginTop: '16px' }}>
            <Col span={12}>
              <Card title="System Performance" extra={<PieChartOutlined />}>
                <p><strong>API Response Time:</strong> {stats?.avgResponseTime || 0}ms</p>
                <p><strong>Server Uptime:</strong> {stats?.uptime || 0}%</p>
                <p><strong>Error Rate:</strong> {stats?.errorRate || 0}%</p>
                <p><strong>Active Connections:</strong> {stats?.activeConnections || 0}</p>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="Geographic Distribution" extra={<BarChartOutlined />}>
                <p><strong>Dar es Salaam:</strong> {stats?.regionStats?.darEsSalaam || 0} users</p>
                <p><strong>Mwanza:</strong> {stats?.regionStats?.mwanza || 0} users</p>
                <p><strong>Dodoma:</strong> {stats?.regionStats?.dodoma || 0} users</p>
                <p><strong>Other Regions:</strong> {stats?.regionStats?.others || 0} users</p>
              </Card>
            </Col>
          </Row>
        </TabPane>

        <TabPane tab="Detailed Analytics" key="2">
          <Card title="Time Series Data" extra={<LineChartOutlined />}>
            <div style={{ marginBottom: '16px' }}>
              <Select
                value={selectedMetric}
                onChange={setSelectedMetric}
                style={{ width: 200, marginRight: '16px' }}
              >
                <Option value="users">User Registrations</Option>
                <Option value="votes">Votes Cast</Option>
                <Option value="posts">Social Posts</Option>
                <Option value="articles">Knowledge Articles</Option>
                <Option value="engagement">User Engagement</Option>
              </Select>

              <RangePicker
                value={dateRange}
                onChange={setDateRange}
                format="YYYY-MM-DD"
              />
            </div>

            {analyticsLoading ? (
              <div style={{ textAlign: 'center', padding: '50px' }}>
                <Spin size="large" />
                <p>Loading analytics data...</p>
              </div>
            ) : (
              <Table
                columns={analyticsColumns}
                dataSource={analytics}
                rowKey="date"
                pagination={{ pageSize: 14 }}
                size="small"
              />
            )}
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default Analytics;