import { useTranslation } from 'react-i18next';
import { Container, Row, Col, Card, Button, Nav, Navbar, ListGroup, Badge, Stack, Image } from 'react-bootstrap';

const ConsoleSettingGroupUser = () => {
  const { t } = useTranslation();

  return (
    <Container fluid className="console-setting-group" style={{ width: '1245px', height: '701px', padding: 0 }}>
      {/* Header */}
      <Navbar bg="light" expand="lg" style={{ height: '78px', padding: 0 }}>
        <Container fluid style={{ height: '100%' }}>
          <Row style={{ height: '100%' }}>
            <Col xs={3} style={{ height: '100%' }}>
              <Card bg="light" style={{ height: '100%', border: 0 }}>
                <Card.Body className="d-flex align-items-center justify-content-center" style={{ height: '100%' }}>
                  <Image src="/logo.png" alt="Logo" style={{ width: '212px', height: '21px' }} />
                </Card.Body>
              </Card>
            </Col>
            <Col xs={9} style={{ height: '100%' }}>
              <Row style={{ height: '100%' }}>
                <Col xs={6}>
                  <ListGroup horizontal style={{ height: '100%', border: 0, padding: 0 }}>
                    <ListGroup.Item className="d-flex align-items-center justify-content-center" style={{ height: '100%', backgroundColor: '#f8f9fa', borderRadius: 0 }}>
                      {t('menu.home')}
                    </ListGroup.Item>
                    <ListGroup.Item className="d-flex align-items-center justify-content-center" style={{ height: '100%', backgroundColor: '#f8f9fa', borderRadius: 0 }}>
                      {t('menu.settings')}
                    </ListGroup.Item>
                    <ListGroup.Item className="d-flex align-items-center justify-content-center" style={{ height: '100%', backgroundColor: '#f8f9fa', borderRadius: 0 }}>
                      {t('menu.profile')}
                    </ListGroup.Item>
                  </ListGroup>
                </Col>
                <Col xs={6}>
                  <Stack gap={2} className="d-flex align-items-center justify-content-end" style={{ height: '100%' }}>
                    <Badge bg="secondary" text="white" style={{ width: '23px', height: '23px' }} />
                    <Badge bg="secondary" text="white" style={{ width: '1px', height: '12px' }} />
                    <Badge bg="secondary" text="white" style={{ width: '125px', height: '25px' }} />
                    <Badge bg="secondary" text="white" style={{ width: '1px', height: '12px' }} />
                    <Badge bg="secondary" text="white" style={{ width: '102px', height: '24px' }} />
                    <Badge bg="secondary" text="white" style={{ width: '1px', height: '12px' }} />
                    <Badge bg="secondary" text="white" style={{ width: '1px', height: '12px' }} />
                    <Badge bg="secondary" text="white" style={{ width: '29px', height: '29px' }} />
                  </Stack>
                </Col>
              </Row>
            </Col>
          </Row>
        </Container>
      </Navbar>

      {/* Main Content */}
      <Container fluid style={{ height: '623px', padding: 0 }}>
        <Row style={{ height: '100%' }}>
          {/* Left Sidebar */}
          <Col xs={3} style={{ height: '100%' }}>
            <Card bg="light" style={{ height: '100%', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <Card.Header className="bg-transparent border-bottom-0">
                <Card.Title className="mb-0">{t('sidebar.title')}</Card.Title>
              </Card.Header>
              <Card.Body className="p-3">
                <ListGroup variant="flush">
                  <ListGroup.Item className="d-flex align-items-center justify-content-between px-3 py-2">
                    <span>{t('sidebar.item1')}</span>
                    <Badge bg="primary">3</Badge>
                  </ListGroup.Item>
                  <ListGroup.Item className="d-flex align-items-center justify-content-between px-3 py-2">
                    <span>{t('sidebar.item2')}</span>
                  </ListGroup.Item>
                  <ListGroup.Item className="d-flex align-items-center justify-content-between px-3 py-2">
                    <span>{t('sidebar.item3')}</span>
                  </ListGroup.Item>
                </ListGroup>
              </Card.Body>
            </Card>
          </Col>

          {/* Main Content Area */}
          <Col xs={9} style={{ height: '100%' }}>
            <Card bg="light" style={{ height: '100%', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <Card.Header className="bg-transparent border-bottom-0 d-flex align-items-center justify-content-between">
                <Card.Title className="mb-0">{t('main.title')}</Card.Title>
                <Button variant="outline-secondary" size="sm">{t('main.action')}</Button>
              </Card.Header>
              <Card.Body className="p-4">
                <Row className="mb-3">
                  <Col xs={4}>
                    <div className="bg-light p-3 rounded" style={{ height: '23px' }}>{t('main.label1')}</div>
                  </Col>
                  <Col xs={4}>
                    <div className="bg-light p-3 rounded" style={{ height: '23px' }}>{t('main.label2')}</div>
                  </Col>
                  <Col xs={4}>
                    <div className="bg-light p-3 rounded" style={{ height: '23px' }}>{t('main.label3')}</div>
                  </Col>
                </Row>

                <Row className="mb-3">
                  <Col xs={6}>
                    <div className="bg-light p-3 rounded" style={{ height: '23px' }}>{t('main.label4')}</div>
                  </Col>
                  <Col xs={6}>
                    <div className="bg-light p-3 rounded" style={{ height: '23px' }}>{t('main.label5')}</div>
                  </Col>
                </Row>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label6')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label7')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label8')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label9')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label10')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label11')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label12')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label13')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label14')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label15')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label16')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label17')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label18')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label19')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label20')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label21')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label22')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label23')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label24')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label25')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label26')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label27')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label28')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label29')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label30')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label31')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label32')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label33')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label34')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label35')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label36')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label37')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label38')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label39')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label40')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label41')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label42')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label43')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label44')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label45')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label46')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label47')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label48')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label49')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label50')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label51')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label52')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label53')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label54')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label55')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label56')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label57')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label58')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label59')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label60')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label61')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label62')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label63')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label64')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label65')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label66')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label67')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label68')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label69')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label70')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label71')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label72')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label73')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label74')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label75')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label76')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label77')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label78')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label79')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label80')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label81')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label82')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label83')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label84')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label85')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label86')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label87')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label88')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label89')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label90')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label91')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label92')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label93')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label94')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label95')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label96')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label97')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label98')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label99')}</div>

                <div className="bg-light p-3 rounded" style={{ height: '18px' }}>{t('main.label100')}</div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </Container>
  );
};

export default ConsoleSettingGroupUser;