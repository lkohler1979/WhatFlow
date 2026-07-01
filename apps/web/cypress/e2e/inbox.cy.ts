describe('Inbox', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/inbox');
    cy.location('pathname', { timeout: 10000 }).should('eq', '/inbox');
  });

  it('carrega a lista de conversas (ou mostra o estado vazio) sem erro', () => {
    cy.get('[data-cy="conversation-list"]', { timeout: 10000 }).should('be.visible');

    // A lista termina em um dos dois estados possíveis: com conversas ou vazia.
    cy.get('[data-cy="conversation-list"]', { timeout: 10000 }).should($list => {
      const hasItems = $list.find('[data-cy="conversation-item"]').length > 0;
      const hasEmptyState = $list.find('[data-cy="conversation-list-empty"]').length > 0;
      expect(hasItems || hasEmptyState, 'lista com itens ou estado vazio visível').to.be.true;
    });

    // Sem conversa selecionada, o painel de chat mostra o placeholder.
    cy.get('[data-cy="chat-window-empty"]').should('be.visible');
  });

  it('ao selecionar uma conversa (se houver), exibe o cabeçalho do contato no chat', () => {
    cy.get('[data-cy="conversation-list"]', { timeout: 10000 }).then($list => {
      const items = $list.find('[data-cy="conversation-item"]');
      if (items.length === 0) {
        cy.log('Nenhuma conversa disponível neste tenant — pulando a seleção.');
        return;
      }
      cy.wrap(items.first()).click();
      cy.get('[data-cy="chat-header"]', { timeout: 10000 }).should('be.visible');
      cy.get('[data-cy="chat-contact-name"]').should('not.be.empty');
    });
  });
});
