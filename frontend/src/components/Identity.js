import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Select, Table, Modal, message, Spin, Alert, Tabs } from 'antd';
import { UserAddOutlined, LoginOutlined, IdcardOutlined, CheckCircleOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Option } = Select;
const { TabPane } = Tabs;

const Identity = () => {
  const [form] = Form.useForm();
  const [loginForm] = Form.useForm();
  const [citizens, setCitizens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCitizens();
    checkCurrentUser();
  }, []);

  const fetchCitizens = async () => {
    try {
      setTableLoading(true);
      const response = await axios.get('/api/identity/citizens');
      setCitizens(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch citizens');
      console.error('Fetch citizens error:', err);
    } finally {
      setTableLoading(false);
    }
  };

  const checkCurrentUser = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const response = await axios.get('/api/identity/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCurrentUser(response.data);
      }
    } catch (err) {
      console.error('Check user error:', err);
    }
  };

  const handleRegister = async (values) => {
    try {
      setLoading(true);
      const response = await axios.post('/api/identity/register', values);
      message.success('Registration successful!');
      form.resetFields();
      fetchCitizens();
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
      message.error('Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (values) => {
    try {
      setLoading(true);
      const response = await axios.post('/api/identity/login', values);
      localStorage.setItem('token', response.data.token);
      setCurrentUser(response.data.user);
      message.success('Login successful!');
      loginForm.resetFields();
      setIsModalVisible(false);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
      message.error('Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setCurrentUser(null);
    message.success('Logged out successfully');
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Region',
      dataIndex: 'region',
      key: 'region',
    },
    {
      title: 'Status',
      dataIndex: 'verified',
      key: 'verified',
      render: (verified) => verified ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : 'Pending',
    },
  ];

  return (
    <div>
      <h1>Identity Management</h1>
      <p>Manage citizen registration, authentication, and identity verification.</p>

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
        <TabPane tab="Register Citizen" key="1">
          <Card title="New Citizen Registration" extra={<UserAddOutlined />}>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleRegister}
            >
              <Form.Item
                name="name"
                label="Full Name"
                rules={[{ required: true, message: 'Please enter your full name' }]}
              >
                <Input placeholder="Enter your full name" />
              </Form.Item>

              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Please enter your email' },
                  { type: 'email', message: 'Please enter a valid email' }
                ]}
              >
                <Input placeholder="Enter your email" />
              </Form.Item>

              <Form.Item
                name="password"
                label="Password"
                rules={[{ required: true, message: 'Please enter a password' }]}
              >
                <Input.Password placeholder="Enter your password" />
              </Form.Item>

              <Form.Item
                name="region"
                label="Region"
                rules={[{ required: true, message: 'Please select your region' }]}
              >
                <Select placeholder="Select your region">
                  <Option value="dar-es-salaam">Dar es Salaam</Option>
                  <Option value="mwanza">Mwanza</Option>
                  <Option value="dodoma">Dodoma</Option>
                  <Option value="arusha">Arusha</Option>
                  <Option value="mbeya">Mbeya</Option>
                  <Option value="tanga">Tanga</Option>
                  <Option value="kigoma">Kigoma</Option>
                  <Option value="iringa">Iringa</Option>
                  <Option value="tabora">Tabora</Option>
                  <Option value="morogoro">Morogoro</Option>
                </Select>
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} block>
                  Register
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>

        <TabPane tab="Citizens List" key="2">
          <Card title="Registered Citizens" extra={<IdcardOutlined />}>
            <Table
              columns={columns}
              dataSource={citizens}
              loading={tableLoading}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </TabPane>

        <TabPane tab="Authentication" key="3">
          <Card title="User Authentication" extra={<LoginOutlined />}>
            {currentUser ? (
              <div>
                <p><strong>Logged in as:</strong> {currentUser.name}</p>
                <p><strong>Email:</strong> {currentUser.email}</p>
                <Button type="primary" danger onClick={handleLogout}>
                  Logout
                </Button>
              </div>
            ) : (
              <div>
                <Button type="primary" onClick={() => setIsModalVisible(true)}>
                  Login
                </Button>
              </div>
            )}
          </Card>
        </TabPane>
      </Tabs>

      <Modal
        title="Login"
        visible={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
      >
        <Form
          form={loginForm}
          layout="vertical"
          onFinish={handleLogin}
        >
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Please enter a valid email' }
            ]}
          >
            <Input placeholder="Enter your email" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: 'Please enter your password' }]}
          >
            <Input.Password placeholder="Enter your password" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              Login
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Identity;