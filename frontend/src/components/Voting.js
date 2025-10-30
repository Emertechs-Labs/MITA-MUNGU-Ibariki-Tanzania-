import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Select, Table, Modal, message, Spin, Alert, Tabs, Radio, Progress } from 'antd';
import { VoteOutlined, PlusOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Option } = Select;
const { TabPane } = Tabs;
const { TextArea } = Input;

const Voting = () => {
  const [form] = Form.useForm();
  const [voteForm] = Form.useForm();
  const [elections, setElections] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedElection, setSelectedElection] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchElections();
  }, []);

  const fetchElections = async () => {
    try {
      setTableLoading(true);
      const response = await axios.get('/api/voting/elections');
      setElections(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch elections');
      console.error('Fetch elections error:', err);
    } finally {
      setTableLoading(false);
    }
  };

  const fetchCandidates = async (electionId) => {
    try {
      const response = await axios.get(`/api/voting/elections/${electionId}/candidates`);
      setCandidates(response.data);
    } catch (err) {
      console.error('Fetch candidates error:', err);
    }
  };

  const handleCreateElection = async (values) => {
    try {
      setLoading(true);
      const response = await axios.post('/api/voting/elections', values);
      message.success('Election created successfully!');
      form.resetFields();
      fetchElections();
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create election');
      message.error('Failed to create election');
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (values) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      await axios.post('/api/voting/vote', {
        electionId: selectedElection.id,
        candidateId: values.candidateId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success('Vote cast successfully!');
      voteForm.resetFields();
      setIsModalVisible(false);
      fetchElections();
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cast vote');
      message.error('Failed to cast vote');
    } finally {
      setLoading(false);
    }
  };

  const getElectionStatus = (startDate, endDate) => {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (now < start) return { status: 'Upcoming', color: 'blue', icon: <ClockCircleOutlined /> };
    if (now > end) return { status: 'Completed', color: 'green', icon: <CheckCircleOutlined /> };
    return { status: 'Active', color: 'orange', icon: <VoteOutlined /> };
  };

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Start Date',
      dataIndex: 'startDate',
      key: 'startDate',
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'End Date',
      dataIndex: 'endDate',
      key: 'endDate',
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Status',
      dataIndex: 'startDate',
      key: 'status',
      render: (startDate, record) => {
        const { status, color, icon } = getElectionStatus(startDate, record.endDate);
        return <span style={{ color }}>{icon} {status}</span>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record) => {
        const { status } = getElectionStatus(record.startDate, record.endDate);
        return status === 'Active' ? (
          <Button
            type="primary"
            onClick={() => {
              setSelectedElection(record);
              fetchCandidates(record.id);
              setIsModalVisible(true);
            }}
          >
            Vote
          </Button>
        ) : null;
      },
    },
  ];

  return (
    <div>
      <h1>Voting System</h1>
      <p>Manage elections, candidates, and voting processes for Tanzanian democracy.</p>

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
        <TabPane tab="Create Election" key="1">
          <Card title="New Election" extra={<PlusOutlined />}>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleCreateElection}
            >
              <Form.Item
                name="title"
                label="Election Title"
                rules={[{ required: true, message: 'Please enter election title' }]}
              >
                <Input placeholder="Enter election title" />
              </Form.Item>

              <Form.Item
                name="description"
                label="Description"
                rules={[{ required: true, message: 'Please enter election description' }]}
              >
                <TextArea
                  placeholder="Enter election description"
                  rows={4}
                />
              </Form.Item>

              <Form.Item
                name="startDate"
                label="Start Date"
                rules={[{ required: true, message: 'Please select start date' }]}
              >
                <Input type="datetime-local" />
              </Form.Item>

              <Form.Item
                name="endDate"
                label="End Date"
                rules={[{ required: true, message: 'Please select end date' }]}
              >
                <Input type="datetime-local" />
              </Form.Item>

              <Form.Item
                name="type"
                label="Election Type"
                rules={[{ required: true, message: 'Please select election type' }]}
              >
                <Select placeholder="Select election type">
                  <Option value="presidential">Presidential</Option>
                  <Option value="parliamentary">Parliamentary</Option>
                  <Option value="local">Local Government</Option>
                  <Option value="referendum">Referendum</Option>
                </Select>
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} block>
                  Create Election
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>

        <TabPane tab="Elections List" key="2">
          <Card title="Active Elections" extra={<VoteOutlined />}>
            <Table
              columns={columns}
              dataSource={elections}
              loading={tableLoading}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </TabPane>
      </Tabs>

      <Modal
        title={`Vote in: ${selectedElection?.title}`}
        visible={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={voteForm}
          layout="vertical"
          onFinish={handleVote}
        >
          <Form.Item
            name="candidateId"
            label="Select Candidate"
            rules={[{ required: true, message: 'Please select a candidate' }]}
          >
            <Radio.Group>
              {candidates.map(candidate => (
                <Radio key={candidate.id} value={candidate.id} style={{ display: 'block', marginBottom: '8px' }}>
                  <div>
                    <strong>{candidate.name}</strong>
                    <p style={{ margin: '4px 0', color: '#666' }}>{candidate.party}</p>
                    <p style={{ margin: '4px 0' }}>{candidate.description}</p>
                  </div>
                </Radio>
              ))}
            </Radio.Group>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              Cast Vote
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Voting;