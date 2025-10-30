import React, { useState } from 'react';
import { Card, Form, Input, Button, Select, Tabs, Alert, Spin } from 'antd';
import { ApiOutlined, SendOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Option } = Select;
const { TabPane } = Tabs;
const { TextArea } = Input;

const ApiTest = () => {
  const [form] = Form.useForm();
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const apiEndpoints = {
    // Identity endpoints
    'GET /api/identity/citizens': { method: 'GET', description: 'Get all citizens' },
    'POST /api/identity/register': { method: 'POST', description: 'Register new citizen' },
    'POST /api/identity/login': { method: 'POST', description: 'Login citizen' },

    // Voting endpoints
    'GET /api/voting/elections': { method: 'GET', description: 'Get all elections' },
    'POST /api/voting/elections': { method: 'POST', description: 'Create new election' },
    'POST /api/voting/vote': { method: 'POST', description: 'Cast a vote' },

    // Social endpoints
    'GET /api/social/posts': { method: 'GET', description: 'Get all posts' },
    'POST /api/social/posts': { method: 'POST', description: 'Create new post' },

    // Knowledge endpoints
    'GET /api/knowledge/articles': { method: 'GET', description: 'Get all articles' },
    'POST /api/knowledge/articles': { method: 'POST', description: 'Create new article' },
    'GET /api/knowledge/categories': { method: 'GET', description: 'Get categories' },

    // Analytics endpoints
    'GET /api/analytics/stats': { method: 'GET', description: 'Get platform statistics' },
    'GET /api/analytics/data': { method: 'GET', description: 'Get analytics data' },

    // Health check
    'GET /api/health': { method: 'GET', description: 'Health check' },
  };

  const handleApiCall = async (values) => {
    try {
      setLoading(true);
      setError(null);

      const endpoint = values.endpoint;
      const method = apiEndpoints[endpoint].method;
      const url = endpoint.split(' ')[1];
      let data = {};

      if (values.body) {
        try {
          data = JSON.parse(values.body);
        } catch (e) {
          setError('Invalid JSON in request body');
          return;
        }
      }

      const headers = {};
      if (values.authToken) {
        headers.Authorization = `Bearer ${values.authToken}`;
      }

      const config = {
        method,
        url,
        headers,
        ...(method !== 'GET' && { data }),
        params: values.queryParams ? JSON.parse(values.queryParams) : undefined,
      };

      const apiResponse = await axios(config);
      setResponse({
        status: apiResponse.status,
        statusText: apiResponse.statusText,
        data: apiResponse.data,
        headers: apiResponse.headers,
      });

    } catch (err) {
      setError(err.response?.data?.message || err.message);
      if (err.response) {
        setResponse({
          status: err.response.status,
          statusText: err.response.statusText,
          data: err.response.data,
          headers: err.response.headers,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const sampleBodies = {
    'POST /api/identity/register': JSON.stringify({
      name: "John Doe",
      email: "john@example.com",
      password: "password123",
      region: "dar-es-salaam"
    }, null, 2),
    'POST /api/identity/login': JSON.stringify({
      email: "john@example.com",
      password: "password123"
    }, null, 2),
    'POST /api/voting/elections': JSON.stringify({
      title: "Sample Election",
      description: "A test election",
      startDate: "2024-01-01T00:00:00Z",
      endDate: "2024-12-31T23:59:59Z",
      type: "presidential"
    }, null, 2),
    'POST /api/social/posts': JSON.stringify({
      content: "This is a test post",
      type: "text"
    }, null, 2),
    'POST /api/knowledge/articles': JSON.stringify({
      title: "Sample Article",
      category: "Education",
      content: "This is a sample knowledge article",
      tags: "education, democracy"
    }, null, 2),
  };

  return (
    <div>
      <h1>API Testing</h1>
      <p>Test the Tanzania Platform backend APIs directly.</p>

      <Tabs defaultActiveKey="1">
        <TabPane tab="API Tester" key="1">
          <Card title="API Request Builder" extra={<ApiOutlined />}>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleApiCall}
            >
              <Form.Item
                name="endpoint"
                label="API Endpoint"
                rules={[{ required: true, message: 'Please select an endpoint' }]}
              >
                <Select placeholder="Select API endpoint">
                  {Object.entries(apiEndpoints).map(([endpoint, info]) => (
                    <Option key={endpoint} value={endpoint}>
                      {endpoint} - {info.description}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="authToken"
                label="Authorization Token (optional)"
              >
                <Input placeholder="Bearer token for authenticated requests" />
              </Form.Item>

              <Form.Item
                name="queryParams"
                label="Query Parameters (JSON, optional)"
              >
                <TextArea
                  placeholder='{"key": "value"}'
                  rows={2}
                />
              </Form.Item>

              <Form.Item
                name="body"
                label="Request Body (JSON, for POST/PUT)"
              >
                <TextArea
                  placeholder="Request body in JSON format"
                  rows={6}
                />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  icon={<SendOutlined />}
                  block
                >
                  Send Request
                </Button>
              </Form.Item>
            </Form>
          </Card>

          {error && (
            <Alert
              message="Request Error"
              description={error}
              type="error"
              showIcon
              style={{ marginTop: '16px' }}
            />
          )}

          {response && (
            <Card title="API Response" style={{ marginTop: '16px' }}>
              <div className="api-test-result">
                <p><strong>Status:</strong> {response.status} {response.statusText}</p>
                <p><strong>Response:</strong></p>
                <pre>{JSON.stringify(response.data, null, 2)}</pre>
                <p><strong>Headers:</strong></p>
                <pre>{JSON.stringify(response.headers, null, 2)}</pre>
              </div>
            </Card>
          )}
        </TabPane>

        <TabPane tab="Sample Requests" key="2">
          <Card title="Sample API Requests">
            <div>
              <h3>Identity Service</h3>
              <p><strong>Register Citizen:</strong></p>
              <pre>{sampleBodies['POST /api/identity/register']}</pre>

              <p><strong>Login:</strong></p>
              <pre>{sampleBodies['POST /api/identity/login']}</pre>

              <h3>Voting Service</h3>
              <p><strong>Create Election:</strong></p>
              <pre>{sampleBodies['POST /api/voting/elections']}</pre>

              <h3>Social Service</h3>
              <p><strong>Create Post:</strong></p>
              <pre>{sampleBodies['POST /api/social/posts']}</pre>

              <h3>Knowledge Service</h3>
              <p><strong>Create Article:</strong></p>
              <pre>{sampleBodies['POST /api/knowledge/articles']}</pre>
            </div>
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default ApiTest;