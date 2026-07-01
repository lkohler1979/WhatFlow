describe('Campanhas', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/campaigns');
    cy.location('pathname', { timeout: 10000 }).should('eq', '/campaigns');
  });

  it('cria uma campanha e confirma que ela aparece na lista', () => {
    const campaignName = `Campanha Cypress ${Date.now()}`;

    // Aguarda os contatos e instâncias carregarem antes de interagir.
    cy.get('[data-cy="campaign-contact-row"], [data-cy="campaigns-empty"]', { timeout: 10000 });

    cy.get('[data-cy="campaign-name"]').type(campaignName);
    cy.get('[data-cy="campaign-instance"]').select(1);
    cy.get('[data-cy="campaign-message"]').type('Mensagem de teste do Cypress');
    cy.get('[data-cy="campaign-contact-checkbox"]').first().check({ force: true });

    cy.get('[data-cy="campaign-submit"]').should('not.be.disabled').click();

    cy.contains('[data-cy="campaign-card-name"]', campaignName, { timeout: 10000 })
      .scrollIntoView()
      .should('be.visible');
  });

  it('lista as campanhas existentes ou mostra o estado vazio', () => {
    cy.get('[data-cy="campaigns-total"]').should('be.visible');
    cy.get(
      '[data-cy="campaign-list"], [data-cy="campaigns-empty"], [data-cy="campaigns-loading"]',
    ).should('exist');
  });
});
