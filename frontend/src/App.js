import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout, Menu, Typography, Space, Card, Row, Col, Button, Alert } from 'antd';
import {
  HomeOutlined,
  UserOutlined,
  CheckCircleOutlined,
  MessageOutlined,
  BookOutlined,
  BarChartOutlined,
  CloudOutlined
} from '@ant-design/icons';
import './App.css';

const { Header, Content, Footer, Sider } = Layout;
const { Title } = Typography;

function IntroAnimation({ onComplete }) {
  const [currentText, setCurrentText] = React.useState("Mungu Ibariki Tanzania");

  React.useEffect(() => {
    const timer1 = setTimeout(() => setCurrentText("Tanzania Platform"), 2000);
    const timer2 = setTimeout(() => setCurrentText("Tanzania's Truly Decentralized"), 4000);
    const timer3 = setTimeout(() => onComplete(), 6000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onComplete]);

  return (
    <div className="intro-animation">
      <div key={currentText} className="intro-text">{currentText}</div>
    </div>
  );
}

function App() {
  const [collapsed, setCollapsed] = React.useState(false);
  const [healthStatus, setHealthStatus] = React.useState(null);
  const [showAnimation, setShowAnimation] = React.useState(true);

  React.useEffect(() => {
    // Test backend connection
    fetch('/health')
      .then(response => response.json())
      .then(data => setHealthStatus(data))
      .catch(error => setHealthStatus({ error: error.message }));
  }, []);

  if (showAnimation) {
    return <IntroAnimation onComplete={() => setShowAnimation(false)} />;
  }

  const menuItems = [
    { key: '1', icon: <HomeOutlined />, label: 'Dashboard' },
    { key: '2', icon: <UserOutlined />, label: 'Identity' },
    { key: '3', icon: <CheckCircleOutlined />, label: 'Voting' },
    { key: '4', icon: <MessageOutlined />, label: 'Social' },
    { key: '5', icon: <BookOutlined />, label: 'Knowledge' },
    { key: '6', icon: <BarChartOutlined />, label: 'Analytics' },
    { key: '7', icon: <CloudOutlined />, label: 'API Test' },
  ];

  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
          <div className="logo" style={{ padding: '16px', textAlign: 'center' }}>
            <Title level={collapsed ? 4 : 3} style={{ color: 'white', margin: 0 }}>
              {collapsed ? '🇹🇿' : 'Tanzania\'s Truly Decentralized'}
            </Title>
          </div>
          <Menu theme="dark" defaultSelectedKeys={['1']} mode="inline" items={menuItems} />
        </Sider>
        <Layout>
          <Header style={{ padding: '0 24px', background: '#fff' }}>
            <Title level={2} style={{ margin: '16px 0' }}>
              Tanzania's Truly Decentralized
            </Title>
          </Header>
          <Content style={{ margin: '24px 16px', padding: 24, background: '#fff' }}>
            {healthStatus && (
              <Alert
                message="Backend Connection Status"
                description={
                  healthStatus.error ?
                    `❌ Backend not reachable: ${healthStatus.error}` :
                    `✅ Backend connected - ${healthStatus.services ? Object.keys(healthStatus.services).length : 0} services active`
                }
                type={healthStatus.error ? 'error' : 'success'}
                showIcon
                style={{ marginBottom: 24 }}
              />
            )}

            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/identity" element={<Identity />} />
              <Route path="/voting" element={<Voting />} />
              <Route path="/social" element={<Social />} />
              <Route path="/knowledge" element={<Knowledge />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/api-test" element={<ApiTest />} />
            </Routes>
          </Content>
          <Footer style={{ textAlign: 'center' }}>
            Tanzania's Truly Decentralized ©2025 - Secure Digital Democracy
          </Footer>
        </Layout>
      </Layout>
    </Router>
  );
}

function Dashboard() {
  return (
    <div>
      <Title level={2}>Dashboard</Title>
      <Row gutter={16}>
        <Col span={8}>
          <Card title="Identity Management" bordered={false}>
            <p>DID-based citizen identity verification</p>
            <Button type="primary">Test Identity</Button>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Voting System" bordered={false}>
            <p>Verifiable cryptographic voting</p>
            <Button type="primary">Test Voting</Button>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Social Platform" bordered={false}>
            <p>Censorship-resistant social media</p>
            <Button type="primary">Test Social</Button>
          </Card>
        </Col>
      </Row>
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="AI Integration" bordered={false}>
            <p>SingularityNET, MeTTa, and Hyperon AI services</p>
            <Button type="primary">Test AI Services</Button>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Analytics" bordered={false}>
            <p>Real-time platform analytics and insights</p>
            <Button type="primary">View Analytics</Button>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

function Identity() {
  return (
    <div>
      <Title level={2}>Identity Management</Title>
      <Card title="DID Registration" style={{ marginBottom: 16 }}>
        <p>Test DID (Decentralized Identifier) creation and management</p>
        <Button type="primary">Register DID</Button>
      </Card>
      <Card title="Biometric Verification">
        <p>Test biometric enrollment and verification</p>
        <Button type="primary">Test Biometrics</Button>
      </Card>
    </div>
  );
}

function Voting() {
  return (
    <div>
      <Title level={2}>Voting System</Title>
      <Card title="Election Management" style={{ marginBottom: 16 }}>
        <p>Create and manage elections with cryptographic verification</p>
        <Button type="primary">Create Election</Button>
      </Card>
      <Card title="Vote Casting">
        <p>Test secure vote casting and verification</p>
        <Button type="primary">Cast Vote</Button>
      </Card>
    </div>
  );
}

function Social() {
  return (
    <div>
      <Title level={2}>Social Platform</Title>
      <Card title="Post Creation" style={{ marginBottom: 16 }}>
        <p>Create censorship-resistant social media posts</p>
        <Button type="primary">Create Post</Button>
      </Card>
      <Card title="Real-time Feed">
        <p>View real-time social media feed with AI moderation</p>
        <Button type="primary">View Feed</Button>
      </Card>
    </div>
  );
}

function Knowledge() {
  return (
    <div>
      <Title level={2}>Knowledge Base</Title>
      <Card title="Document Management" style={{ marginBottom: 16 }}>
        <p>Manage and search platform knowledge documents</p>
        <Button type="primary">Upload Document</Button>
      </Card>
      <Card title="AI-Powered Search">
        <p>Search knowledge base with AI assistance</p>
        <Button type="primary">Search Knowledge</Button>
      </Card>
    </div>
  );
}

function Analytics() {
  return (
    <div>
      <Title level={2}>Analytics Dashboard</Title>
      <Card title="Platform Metrics" style={{ marginBottom: 16 }}>
        <p>Real-time platform usage and performance metrics</p>
        <Button type="primary">View Metrics</Button>
      </Card>
      <Card title="AI Insights">
        <p>AI-powered analytics and recommendations</p>
        <Button type="primary">Get Insights</Button>
      </Card>
    </div>
  );
}

function ApiTest() {
  const [apiResults, setApiResults] = React.useState({});

  const testEndpoint = async (endpoint, method = 'GET') => {
    try {
      const response = await fetch(`/${endpoint}`, { method });
      const data = await response.json();
      setApiResults(prev => ({
        ...prev,
        [endpoint]: { status: response.status, data }
      }));
    } catch (error) {
      setApiResults(prev => ({
        ...prev,
        [endpoint]: { error: error.message }
      }));
    }
  };

  return (
    <div>
      <Title level={2}>API Testing</Title>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Card title="Health Check">
          <Button onClick={() => testEndpoint('health')}>Test /health</Button>
          {apiResults.health && (
            <pre style={{ marginTop: 8 }}>
              {JSON.stringify(apiResults.health, null, 2)}
            </pre>
          )}
        </Card>

        <Card title="Readiness Check">
          <Button onClick={() => testEndpoint('ready')}>Test /ready</Button>
          {apiResults.ready && (
            <pre style={{ marginTop: 8 }}>
              {JSON.stringify(apiResults.ready, null, 2)}
            </pre>
          )}
        </Card>

        <Card title="API Endpoints">
          <Space wrap>
            <Button onClick={() => testEndpoint('api/v1/identity/profile')}>Identity Profile</Button>
            <Button onClick={() => testEndpoint('api/v1/voting/elections')}>Elections</Button>
            <Button onClick={() => testEndpoint('api/v1/social/posts')}>Social Posts</Button>
            <Button onClick={() => testEndpoint('api/v1/knowledge/search')}>Knowledge Search</Button>
            <Button onClick={() => testEndpoint('api/v1/analytics/metrics')}>Analytics</Button>
          </Space>
        </Card>
      </Space>
    </div>
  );
}

export default App;