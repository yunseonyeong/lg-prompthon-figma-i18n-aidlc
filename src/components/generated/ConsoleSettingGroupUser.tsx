import { FormEvent, useState } from 'react';
import {
  Card,
  CardHeader,
  CardBody,
  Form,
  FormGroup,
  FormLabel,
  FormControl,
  Button,
  Table,
  Row,
  Col,
  Badge,
} from 'react-bootstrap';
import { useTranslation } from 'react-i18next';

const ConsoleSettingGroupUser = () => {
  const { t } = useTranslation();

  // Form state for workspace/group settings
  const [workspaceName, setWorkspaceName] = useState('');
  const [businessSite, setBusinessSite] = useState('');
  const [description, setDescription] = useState('');

  // License management state
  const [licenseCount, setLicenseCount] = useState(5);
  const [userCount, setUserCount] = useState(3);
  const [deviceCount] = useState(8);

  // User/device table data
  const [users] = useState([
    { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'Admin', status: 'Active' },
    { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'User', status: 'Active' },
    { id: 3, name: 'Charlie Brown', email: 'charlie@example.com', role: 'Viewer', status: 'Inactive' },
  ]);

  const [devices] = useState([
    { id: 'DEV-001', name: 'Laptop Pro', type: 'Laptop', status: 'Online' },
    { id: 'DEV-002', name: 'Desktop X', type: 'Desktop', status: 'Offline' },
    { id: 'DEV-003', name: 'Tablet Air', type: 'Tablet', status: 'Online' },
    { id: 'DEV-004', name: 'Phone 12', type: 'Mobile', status: 'Online' },
    { id: 'DEV-005', name: 'Server Rack', type: 'Server', status: 'Online' },
    { id: 'DEV-006', name: 'Printer HP', type: 'Printer', status: 'Offline' },
    { id: 'DEV-007', name: 'Scanner Epson', type: 'Scanner', status: 'Online' },
    { id: 'DEV-008', name: 'Router Netgear', type: 'Network', status: 'Online' },
  ]);

  // Handle form submit
  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    console.log('Saving settings:', { workspaceName, businessSite, description });
    // TODO: API call to save
  };

  // License management handlers
  const handleAssignLicense = () => {
    if (licenseCount > 0) {
      setLicenseCount(licenseCount - 1);
      setUserCount(userCount + 1);
      console.log('License assigned');
    } else {
      console.log('No licenses available');
    }
  };

  const handleWithdrawLicense = () => {
    if (userCount > 0) {
      setLicenseCount(licenseCount + 1);
      setUserCount(userCount - 1);
      console.log('License withdrawn');
    } else {
      console.log('No users to remove license from');
    }
  };

  const handleExtendLicense = () => {
    setLicenseCount(licenseCount + 1);
    console.log('License extended');
  };

  return (
    <Card>
      <CardHeader>
        <h4 className="mb-0">{t('console.setting.group.title.workspaceGroupSettings')}</h4>
      </CardHeader>
      <CardBody>
        {/* Workspace/Group Settings Section */}
        <Form onSubmit={handleSave}>
          <FormGroup>
            <FormLabel>{t('console.setting.group.label.workspaceName')}</FormLabel>
            <FormControl
              type="text"
              placeholder={t('console.setting.group.label.workspaceName')}
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
            />
          </FormGroup>

          <FormGroup>
            <FormLabel>{t('console.setting.group.label.businessSiteInformation')}</FormLabel>
            <FormControl
              type="text"
              placeholder={t('console.setting.group.label.businessSiteInformation')}
              value={businessSite}
              onChange={(e) => setBusinessSite(e.target.value)}
            />
          </FormGroup>

          <FormGroup>
            <FormLabel>Description</FormLabel>
            <FormControl
              as="textarea"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormGroup>

          <Button variant="primary" type="submit">
            {t('console.setting.group.button.save')}
          </Button>
          <Button variant="secondary" className="ms-2">
            {t('console.setting.group.button.publish')}
          </Button>
        </Form>

        <hr className="my-4" />

        {/* License Management Section */}
        <h5 className="mb-3">{t('console.setting.group.title.licenseManagement')}</h5>
        <Row className="mb-3">
          <Col xs={4}>
            <Badge bg="info" className="me-2">
              {t('console.setting.group.label.licenseCount')}: {licenseCount}
            </Badge>
          </Col>
          <Col xs={4}>
            <Badge bg="success" className="me-2">
              {t('console.setting.group.label.userCount')}: {userCount}
            </Badge>
          </Col>
          <Col xs={4}>
            <Badge bg="warning" className="me-2">
              {t('console.setting.group.label.deviceCount')}: {deviceCount}
            </Badge>
          </Col>
        </Row>

        <Row className="mb-3">
          <Col xs={4}>
            <Button variant="outline-primary" onClick={handleAssignLicense}>
              {t('console.setting.group.button.assign')}
            </Button>
          </Col>
          <Col xs={4}>
            <Button variant="outline-danger" onClick={handleWithdrawLicense}>
              {t('console.setting.group.button.withdraw')}
            </Button>
          </Col>
          <Col xs={4}>
            <Button variant="outline-success" onClick={handleExtendLicense}>
              {t('console.setting.group.button.extend')}
            </Button>
          </Col>
        </Row>

        {/* User/Device Count Table */}
        <h5 className="mb-3">{t('console.setting.group.title.userDeviceTable')}</h5>
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>{t('console.setting.group.label.userCount')}</th>
              <th>{t('console.setting.group.label.deviceCount')}</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{userCount}</td>
              <td>{deviceCount}</td>
              <td>
                <Button variant="link" size="sm" onClick={() => console.log('View users')}>
                  {t('console.setting.group.button.view')}
                </Button>
                <Button variant="link" size="sm" className="ms-2" onClick={() => console.log('View devices')}>
                  {t('console.setting.group.button.view')}
                </Button>
              </td>
            </tr>
          </tbody>
        </Table>

        {/* Detailed Users Table */}
        <h5 className="mt-4 mb-3">{t('console.setting.group.title.users')}</h5>
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>ID</th>
              <th>{t('console.setting.group.label.userName')}</th>
              <th>{t('console.setting.group.label.email')}</th>
              <th>{t('console.setting.group.label.role')}</th>
              <th>{t('console.setting.group.label.status')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.id}</td>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>
                  <Badge bg={user.status === 'Active' ? 'success' : 'secondary'}>
                    {user.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>

        {/* Detailed Devices Table */}
        <h5 className="mt-4 mb-3">{t('console.setting.group.title.devices')}</h5>
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>ID</th>
              <th>{t('console.setting.group.label.deviceName')}</th>
              <th>{t('console.setting.group.label.deviceType')}</th>
              <th>{t('console.setting.group.label.deviceStatus')}</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => (
              <tr key={device.id}>
                <td>{device.id}</td>
                <td>{device.name}</td>
                <td>{device.type}</td>
                <td>
                  <Badge bg={device.status === 'Online' ? 'success' : 'secondary'}>
                    {device.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </CardBody>
    </Card>
  );
};

export default ConsoleSettingGroupUser;