describe('Autenticação', () => {
  it('faz login pela UI com credenciais reais e chega autenticado no dashboard', () => {
    cy.visit('/auth/login');

    cy.get('[data-cy="login-email"]').type('luizarlindo79@gmail.com');
    cy.get('[data-cy="login-password"]').type('123456');
    cy.get('[data-cy="login-submit"]').click();

    cy.location('pathname', { timeout: 10000 }).should('eq', '/dashboard');
    cy.get('[data-cy="user-name"]').should('contain.text', 'Luiz Arlindo');
  });

  it('faz logout e volta para a tela de login', () => {
    cy.login();

    cy.get('[data-cy="logout-button"]').click();

    cy.location('pathname', { timeout: 10000 }).should('eq', '/auth/login');
    cy.window().then(win => {
      expect(win.localStorage.getItem('wf_access_token')).to.be.null;
    });
  });

  it('rejeita credenciais inválidas com mensagem de erro', () => {
    cy.visit('/auth/login');

    cy.get('[data-cy="login-email"]').type('luizarlindo79@gmail.com');
    cy.get('[data-cy="login-password"]').type('senha-errada');
    cy.get('[data-cy="login-submit"]').click();

    cy.get('[data-cy="login-error"]', { timeout: 10000 }).should('be.visible');
    cy.location('pathname').should('eq', '/auth/login');
  });
});
