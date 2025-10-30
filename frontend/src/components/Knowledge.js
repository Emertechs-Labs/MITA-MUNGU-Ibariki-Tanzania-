import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Select, Table, Modal, message, Spin, Alert, Tabs, Tag } from 'antd';
import { BookOutlined, PlusOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Option } = Select;
const { TabPane } = Tabs;
const { TextArea } = Input;

const Knowledge = () => {
  const [form] = Form.useForm();
  const [searchForm] = Form.useForm();
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchArticles();
    fetchCategories();
  }, []);

  const fetchArticles = async () => {
    try {
      setTableLoading(true);
      const response = await axios.get('/api/knowledge/articles');
      setArticles(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch articles');
      console.error('Fetch articles error:', err);
    } finally {
      setTableLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get('/api/knowledge/categories');
      setCategories(response.data);
    } catch (err) {
      console.error('Fetch categories error:', err);
    }
  };

  const handleCreateArticle = async (values) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/knowledge/articles', values, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success('Article created successfully!');
      form.resetFields();
      fetchArticles();
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create article');
      message.error('Failed to create article');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (values) => {
    try {
      setTableLoading(true);
      const response = await axios.get('/api/knowledge/search', {
        params: values
      });
      setArticles(response.data);
      setError(null);
    } catch (err) {
      setError('Search failed');
      console.error('Search error:', err);
    } finally {
      setTableLoading(false);
    }
  };

  const showArticle = (article) => {
    setSelectedArticle(article);
    setIsModalVisible(true);
  };

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (category) => <Tag color="blue">{category}</Tag>,
    },
    {
      title: 'Author',
      dataIndex: 'author',
      key: 'author',
      render: (author) => author?.name || 'Anonymous',
    },
    {
      title: 'Views',
      dataIndex: 'views',
      key: 'views',
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => showArticle(record)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div>
      <h1>Knowledge Base</h1>
      <p>Access educational content, government information, and community knowledge.</p>

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
        <TabPane tab="Create Article" key="1">
          <Card title="Add Knowledge Article" extra={<PlusOutlined />}>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleCreateArticle}
            >
              <Form.Item
                name="title"
                label="Article Title"
                rules={[{ required: true, message: 'Please enter article title' }]}
              >
                <Input placeholder="Enter article title" />
              </Form.Item>

              <Form.Item
                name="category"
                label="Category"
                rules={[{ required: true, message: 'Please select a category' }]}
              >
                <Select placeholder="Select category">
                  {categories.map(cat => (
                    <Option key={cat.id} value={cat.name}>{cat.name}</Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="content"
                label="Content"
                rules={[{ required: true, message: 'Please enter article content' }]}
              >
                <TextArea
                  placeholder="Enter article content"
                  rows={8}
                  showCount
                  maxLength={5000}
                />
              </Form.Item>

              <Form.Item
                name="tags"
                label="Tags (comma-separated)"
              >
                <Input placeholder="e.g., democracy, education, government" />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} block>
                  Create Article
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>

        <TabPane tab="Browse Articles" key="2">
          <Card title="Search Knowledge Base" extra={<SearchOutlined />}>
            <Form
              form={searchForm}
              layout="inline"
              onFinish={handleSearch}
              style={{ marginBottom: '16px' }}
            >
              <Form.Item name="query">
                <Input placeholder="Search articles..." style={{ width: 200 }} />
              </Form.Item>

              <Form.Item name="category">
                <Select placeholder="Filter by category" style={{ width: 150 }}>
                  <Option value="">All Categories</Option>
                  {categories.map(cat => (
                    <Option key={cat.id} value={cat.name}>{cat.name}</Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit">
                  Search
                </Button>
              </Form.Item>

              <Form.Item>
                <Button onClick={() => {
                  searchForm.resetFields();
                  fetchArticles();
                }}>
                  Clear
                </Button>
              </Form.Item>
            </Form>

            <Table
              columns={columns}
              dataSource={articles}
              loading={tableLoading}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </TabPane>
      </Tabs>

      <Modal
        title={selectedArticle?.title}
        visible={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedArticle && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <Tag color="blue">{selectedArticle.category}</Tag>
              <span style={{ marginLeft: '16px', color: '#666' }}>
                By {selectedArticle.author?.name || 'Anonymous'} • {new Date(selectedArticle.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div style={{ whiteSpace: 'pre-wrap' }}>
              {selectedArticle.content}
            </div>
            {selectedArticle.tags && (
              <div style={{ marginTop: '16px' }}>
                {selectedArticle.tags.split(',').map(tag => (
                  <Tag key={tag.trim()}>{tag.trim()}</Tag>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Knowledge;