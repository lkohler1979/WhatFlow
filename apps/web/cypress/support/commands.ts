/// <reference types="cypress" />

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /**
       * Login e2e real via UI: visita /auth/login, preenche o formulário com
       * as credenciais informadas e submete, aguardando o redirecionamento
       * autenticado para /dashboard. Não usa `cy.request` direto na API —
       * é um teste e2e de verdade, exercitando o form de login real.
       */
      login(email?: string, password?: string): Chainable<void>;
    }
  }
}

Cypress.Commands.add('login', (email = 'luizarlindo79@gmail.com', password = '123456') => {
  // cy.session cacheia a sessão (localStorage) entre testes/specs no mesmo run —
  // só refaz o login via UI quando a validação falha. Evita esbarrar no rate
  // limit do backend ao rodar a suíte inteira com vários specs autenticando.
  cy.session(
    `login:${email}`,
    () => {
      cy.visit('/auth/login');
      cy.get('[data-cy="login-email"]').clear().type(email);
      cy.get('[data-cy="login-password"]').clear().type(password, { log: false });
      cy.get('[data-cy="login-submit"]').click();
      cy.location('pathname', { timeout: 15000 }).should('eq', '/dashboard');
    },
    {
      validate: () => {
        expect(window.localStorage.getItem('wf_access_token')).to.not.be.null;
      },
    },
  );
  // cy.session só restaura o storage — não navega. Sempre visitamos /dashboard
  // depois (seja sessão nova ou restaurada) para o app carregar autenticado.
  cy.visit('/dashboard');
});

export {};
