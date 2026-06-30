type NodeType =
  | 'TEXT'
  | 'IMAGE'
  | 'MENU'
  | 'CONDITION'
  | 'DELAY'
  | 'VARIABLE'
  | 'WEBHOOK_CALL'
  | 'AI'
  | 'ASSIGN_AGENT'
  | 'END';

interface FlowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  label?: string | null;
}

interface Flow {
  id: string;
  tenantId: string;
  instanceId: string | null;
  name: string;
  description: string | null;
  triggerType: 'KEYWORD' | 'ANY_MESSAGE' | 'FIRST_MESSAGE' | 'SCHEDULE';
  triggerValue: string | null;
  nodesJson: FlowNode[];
  edgesJson: FlowEdge[];
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  version: number;
  publishedAt: string | null;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

const now = '2026-06-30T12:00:00.000Z';

function makeFlow(overrides: Partial<Flow> = {}): Flow {
  return {
    id: 'flow-p19',
    tenantId: 'tenant-test',
    instanceId: null,
    name: 'Novo fluxo',
    description: null,
    triggerType: 'KEYWORD',
    triggerValue: null,
    nodesJson: [],
    edgesJson: [],
    status: 'DRAFT',
    version: 1,
    publishedAt: null,
    isActive: false,
    priority: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function loginByStorage(win: Cypress.AUTWindow): void {
  win.localStorage.setItem('wf_access_token', 'fake-token');
  win.localStorage.setItem('wf_refresh_token', 'fake-refresh-token');
  win.localStorage.setItem(
    'wf_user',
    JSON.stringify({
      id: 'user-test',
      email: 'qa@whatflow.test',
      fullName: 'QA Visual',
      role: 'OWNER',
      tenantId: 'tenant-test',
    }),
  );
}

function node(type: NodeType, index = 0): Cypress.Chainable<JQuery<HTMLElement>> {
  return cy.get(`[data-cy="flow-node"][data-node-type="${type}"]`).eq(index);
}

function selectNode(type: NodeType, index = 0): void {
  node(type, index).click();
}

function addNode(type: NodeType): void {
  cy.get(`[data-cy="palette-${type}"]`).click();
  node(type).should('be.visible');
}

function connect(
  sourceType: NodeType,
  sourceHandle: string,
  targetType: NodeType,
  targetIndex = 0,
): void {
  node(sourceType)
    .find(`[data-cy="node-handle-out"][data-source-handle="${sourceHandle}"]`)
    .click({ force: true });
  node(targetType, targetIndex).find('[data-cy="node-handle-in"]').click({ force: true });
}

function connectMenuOption(label: string, targetType: NodeType): void {
  node('MENU').contains('[data-cy="node-handle-out"]', label).click({ force: true });
  node(targetType).find('[data-cy="node-handle-in"]').click({ force: true });
}

function dragNode(type: NodeType, dx: number, dy: number): void {
  node(type).then($el => {
    const rect = $el[0].getBoundingClientRect();
    cy.wrap($el).trigger('mousedown', {
      button: 0,
      which: 1,
      clientX: rect.left + 24,
      clientY: rect.top + 24,
      force: true,
    });
    cy.get('body').trigger('mousemove', {
      button: 0,
      which: 1,
      clientX: rect.left + 24 + dx,
      clientY: rect.top + 24 + dy,
      force: true,
    });
    cy.get('body').trigger('mouseup', { force: true });
  });
}

describe('Flow Builder visual', () => {
  it('cria, edita, conecta, salva, reabre, publica e duplica um fluxo', () => {
    let currentFlow: Flow | null = null;
    let listedFlow: Flow | null = null;

    cy.intercept('GET', '**/v1/flows', req => {
      req.reply({ data: listedFlow ? [listedFlow] : [] });
    }).as('listFlows');

    cy.intercept('POST', '**/v1/flows', req => {
      currentFlow = makeFlow({
        ...(req.body as Partial<Flow>),
        id: 'flow-p19',
        name: 'Fluxo P-19 visual',
      });
      listedFlow = currentFlow;
      req.reply(currentFlow);
    }).as('createFlow');

    cy.intercept('GET', '**/v1/flows/*', req => {
      req.reply(currentFlow ?? makeFlow());
    }).as('getFlow');

    cy.intercept('PATCH', '**/v1/flows/*', req => {
      currentFlow = {
        ...(currentFlow ?? makeFlow()),
        ...(req.body as Partial<Flow>),
        updatedAt: new Date().toISOString(),
      };
      listedFlow = currentFlow;
      req.reply(currentFlow);
    }).as('saveFlow');

    cy.intercept('POST', '**/v1/flows/*/publish', req => {
      currentFlow = {
        ...(currentFlow ?? makeFlow()),
        status: 'PUBLISHED',
        publishedAt: new Date().toISOString(),
        isActive: true,
      };
      listedFlow = currentFlow;
      req.reply(currentFlow);
    }).as('publishFlow');

    cy.intercept('POST', '**/v1/flows/*/duplicate', req => {
      currentFlow = {
        ...(currentFlow ?? makeFlow()),
        id: 'flow-p19-copy',
        name: 'Fluxo P-19 visual (cópia)',
        status: 'DRAFT',
        publishedAt: null,
        isActive: false,
        version: 2,
      };
      listedFlow = currentFlow;
      req.reply(currentFlow);
    }).as('duplicateFlow');

    cy.visit('/flows', { onBeforeLoad: loginByStorage });
    cy.wait('@listFlows');
    cy.contains('Nenhum fluxo ainda').should('be.visible');

    cy.get('[data-cy="create-flow"]').click();
    cy.wait('@createFlow');
    cy.wait('@getFlow');
    cy.location('pathname').should('eq', '/flows/flow-p19');

    cy.get('[data-cy="flow-name"]').clear().type('Fluxo P-19 validado').blur();
    cy.get('[data-cy="flow-trigger-value"]').type('oi');

    addNode('TEXT');
    addNode('VARIABLE');
    addNode('MENU');
    addNode('CONDITION');
    addNode('TEXT');
    addNode('END');
    addNode('DELAY');
    addNode('WEBHOOK_CALL');
    addNode('AI');
    addNode('IMAGE');
    addNode('ASSIGN_AGENT');

    selectNode('VARIABLE');
    cy.get('[data-cy="variable-name"]').type('cliente');
    cy.get('[data-cy="variable-value"]').type('Cliente Teste');

    selectNode('TEXT', 0);
    cy.get('[data-cy="node-text"]').type('Olá ');
    cy.contains('button.chip', 'cliente').click();
    cy.contains('.preview', 'Olá Cliente Teste').should('be.visible');

    selectNode('MENU');
    cy.get('[data-cy="menu-text"]').type('Escolha uma opção, {{cliente}}');
    cy.get('[data-cy="add-menu-option"]').click();
    cy.get('[data-cy="add-menu-option"]').click();
    cy.get('[data-cy="menu-option-label"]').eq(0).clear().type('Comprar');
    cy.get('[data-cy="menu-option-label"]').eq(1).clear().type('Falar com humano');
    cy.contains('.preview', 'Escolha uma opção, Cliente Teste').should('be.visible');

    selectNode('CONDITION');
    cy.get('[data-cy="condition-variable"]').type('opcao_selecionada');
    cy.get('[data-cy="condition-operator"]').select('eq');
    cy.get('[data-cy="condition-value"]').type('Comprar');

    selectNode('TEXT', 1);
    cy.get('[data-cy="node-text"]').type('Pedido encaminhado');

    selectNode('DELAY');
    cy.get('[data-cy="delay-ms"]').clear().type('1500');

    selectNode('WEBHOOK_CALL');
    cy.get('[data-cy="webhook-url"]').type('https://example.test/webhook');
    cy.get('[data-cy="webhook-method"]').select('POST');

    selectNode('AI');
    cy.get('[data-cy="node-ai-prompt"]').type('Responda sobre {{ultima_mensagem}}');
    cy.contains('.preview', 'Responda sobre oi').should('be.visible');

    selectNode('IMAGE');
    cy.get('[data-cy="media-url"]').type('https://example.test/banner.png');
    cy.get('[data-cy="media-caption"]').type('Banner para {{cliente}}');
    cy.contains('.preview', 'Banner para Cliente Teste').should('be.visible');

    dragNode('TEXT', 160, 90);

    connect('TEXT', 'out', 'MENU');
    connectMenuOption('Comprar', 'CONDITION');
    connect('CONDITION', 'true', 'TEXT', 1);
    connect('CONDITION', 'false', 'END');

    cy.get('[data-cy="save-flow"]').click();
    cy.wait('@saveFlow').then(({ request }) => {
      const body = request.body as Pick<Flow, 'name' | 'nodesJson' | 'edgesJson'> & {
        triggerValue: string;
      };

      expect(body.name).to.eq('Fluxo P-19 validado');
      expect(body.triggerValue).to.eq('oi');
      expect(body.nodesJson).to.have.length(11);
      expect(body.edgesJson).to.have.length(4);
      expect(body.edgesJson.map(edge => edge.sourceHandle)).to.include.members([
        'out',
        'true',
        'false',
      ]);
      expect(body.edgesJson.some(edge => edge.sourceHandle?.startsWith('opt_'))).to.eq(true);

      const movedText = body.nodesJson.find(item => item.type === 'TEXT');
      expect(movedText?.position.x).to.be.greaterThan(60);
      expect(movedText?.position.y).to.be.greaterThan(60);
    });
    cy.contains('Salvo').should('be.visible');

    cy.get('[data-cy="back-to-flows"]').click();
    cy.wait('@listFlows');
    cy.contains('[data-cy="flow-card"]', 'Fluxo P-19 validado').click();
    cy.wait('@getFlow');
    cy.get('[data-cy="flow-node"][data-node-type="TEXT"]').should('have.length', 2);
    cy.contains('[data-cy="flow-node"]', 'Olá {{cliente}}').should('be.visible');
    cy.get('path[marker-end="url(#arrow)"]').should('have.length', 4);

    cy.get('[data-cy="publish-flow"]').click();
    cy.wait('@publishFlow');
    cy.contains('Publicado').should('be.visible');
    cy.contains('Fluxo publicado é imutável').should('be.visible');

    cy.get('[data-cy="duplicate-flow"]').click();
    cy.wait('@duplicateFlow');
    cy.wait('@getFlow');
    cy.location('pathname').should('eq', '/flows/flow-p19-copy');
    cy.contains('Rascunho').should('be.visible');
    cy.get('[data-cy="flow-name"]').should('have.value', 'Fluxo P-19 visual (cópia)');
  });
});
