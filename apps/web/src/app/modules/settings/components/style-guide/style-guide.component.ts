import { Component } from '@angular/core';

interface ColorToken {
  name: string;
  varName: string;
  hex: string;
}

interface SpaceToken {
  name: string;
  varName: string;
  value: string;
}

// Espelha apps/web/src/styles/_variables.scss — atualize aqui se os tokens mudarem lá.
const COLORS: ColorToken[] = [
  { name: 'Brand', varName: '$brand', hex: '#1a5276' },
  { name: 'Brand dark', varName: '$brand-dark', hex: '#134060' },
  { name: 'Brand light', varName: '$brand-light', hex: '#ebf5fb' },
  { name: 'Accent (WhatsApp)', varName: '$accent', hex: '#25d366' },
  { name: 'Warning', varName: '$warning', hex: '#e67e22' },
  { name: 'Danger', varName: '$danger', hex: '#b42318' },
  { name: 'Success', varName: '$success', hex: '#065f46' },
];

const NEUTRALS: ColorToken[] = [
  { name: 'Background', varName: '$bg', hex: '#f7f9fc' },
  { name: 'Surface', varName: '$surface', hex: '#ffffff' },
  { name: 'Border', varName: '$border', hex: '#dde3eb' },
  { name: 'Border strong', varName: '$border-strong', hex: '#d0d5dd' },
  { name: 'Muted', varName: '$muted', hex: '#8b97a8' },
  { name: 'Text', varName: '$text', hex: '#1a2332' },
  { name: 'Text (sm)', varName: '$text-sm', hex: '#4a5568' },
];

const SPACING: SpaceToken[] = [
  { name: 'space-1', varName: '$space-1', value: '0.25rem' },
  { name: 'space-2', varName: '$space-2', value: '0.5rem' },
  { name: 'space-3', varName: '$space-3', value: '0.75rem' },
  { name: 'space-4', varName: '$space-4', value: '1rem' },
  { name: 'space-5', varName: '$space-5', value: '1.25rem' },
  { name: 'space-6', varName: '$space-6', value: '1.5rem' },
  { name: 'space-8', varName: '$space-8', value: '2rem' },
];

const RADII: SpaceToken[] = [
  { name: 'radius-sm', varName: '$radius-sm', value: '4px' },
  { name: 'radius-md', varName: '$radius-md', value: '8px' },
  { name: 'radius-lg', varName: '$radius-lg', value: '12px' },
  { name: 'radius-full', varName: '$radius-full', value: '9999px' },
];

@Component({
  selector: 'wf-style-guide',
  standalone: true,
  template: `
    <section class="page">
      <header class="page-head">
        <h1>Design System</h1>
        <p class="wf-muted">
          Tokens e componentes base do WhatFlow. Fonte da verdade:
          <code>apps/web/src/styles/_variables.scss</code>. Use as classes <code>.wf-*</code> e os
          tokens SCSS (<code>v.$brand</code> etc.) em vez de valores fixos nos componentes.
        </p>
      </header>

      <section class="block">
        <h2>Cores</h2>
        <div class="swatches">
          @for (c of colors; track c.varName) {
            <div class="swatch">
              <div class="swatch-color" [style.background]="c.hex"></div>
              <div class="swatch-label">
                <strong>{{ c.name }}</strong>
                <code>{{ c.varName }}</code>
                <span class="wf-muted">{{ c.hex }}</span>
              </div>
            </div>
          }
        </div>
      </section>

      <section class="block">
        <h2>Neutros</h2>
        <div class="swatches">
          @for (c of neutrals; track c.varName) {
            <div class="swatch">
              <div
                class="swatch-color"
                [style.background]="c.hex"
                [style.border]="'1px solid #ddd'"
              ></div>
              <div class="swatch-label">
                <strong>{{ c.name }}</strong>
                <code>{{ c.varName }}</code>
                <span class="wf-muted">{{ c.hex }}</span>
              </div>
            </div>
          }
        </div>
      </section>

      <section class="block">
        <h2>Tipografia</h2>
        <div class="type-scale">
          <p class="t-xs">Extra small — 11px — texto auxiliar mínimo</p>
          <p class="t-sm">Small — 12px — legendas, badges</p>
          <p class="t-md">Medium — 14px — corpo de texto padrão</p>
          <p class="t-lg">Large — 16px — títulos de card</p>
          <p class="t-xl">Extra large — 20px — títulos de página</p>
        </div>
      </section>

      <section class="block">
        <h2>Espaçamento</h2>
        <div class="scale-list">
          @for (s of spacing; track s.varName) {
            <div class="scale-row">
              <code>{{ s.varName }}</code>
              <div class="scale-bar" [style.width]="s.value"></div>
              <span class="wf-muted">{{ s.value }}</span>
            </div>
          }
        </div>
      </section>

      <section class="block">
        <h2>Raios de borda</h2>
        <div class="swatches">
          @for (r of radii; track r.varName) {
            <div class="radius-demo">
              <div class="radius-box" [style.border-radius]="r.value"></div>
              <code>{{ r.varName }}</code>
              <span class="wf-muted">{{ r.value }}</span>
            </div>
          }
        </div>
      </section>

      <section class="block">
        <h2>Botões</h2>
        <p class="wf-muted">
          <code>.wf-btn</code>, <code>.wf-btn--primary</code>, <code>.wf-btn--danger</code>
        </p>
        <div class="row">
          <button class="wf-btn">Padrão</button>
          <button class="wf-btn wf-btn--primary">Primário</button>
          <button class="wf-btn wf-btn--danger">Perigo</button>
          <button class="wf-btn" disabled>Desabilitado</button>
        </div>
      </section>

      <section class="block">
        <h2>Campos</h2>
        <p class="wf-muted"><code>.wf-input</code></p>
        <div class="row col">
          <input class="wf-input" placeholder="Campo de texto" style="max-width: 320px" />
          <textarea
            class="wf-input"
            rows="2"
            placeholder="Textarea"
            style="max-width: 320px"
          ></textarea>
          <select class="wf-input" style="max-width: 320px">
            <option>Selecione uma opção</option>
          </select>
        </div>
      </section>

      <section class="block">
        <h2>Badges</h2>
        <p class="wf-muted">
          <code>.wf-badge</code>, <code>.wf-badge--success</code>, <code>.wf-badge--warning</code>,
          <code>.wf-badge--danger</code>
        </p>
        <div class="row">
          <span class="wf-badge">Padrão</span>
          <span class="wf-badge wf-badge--success">Sucesso</span>
          <span class="wf-badge wf-badge--warning">Alerta</span>
          <span class="wf-badge wf-badge--danger">Erro</span>
        </div>
      </section>

      <section class="block">
        <h2>Card</h2>
        <p class="wf-muted">
          classe utilitária <code>.card</code> (mixin <code>mixins.card</code>)
        </p>
        <div class="card demo-card">
          <strong>Título do card</strong>
          <p class="wf-muted">Conteúdo de exemplo usando a classe <code>.card</code> global.</p>
        </div>
      </section>

      <section class="block">
        <h2>Texto auxiliar</h2>
        <p class="wf-muted">Texto discreto (<code>.wf-muted</code>) para legendas e ajuda.</p>
        <p class="wf-error">Mensagem de erro (<code>.wf-error</code>).</p>
      </section>
    </section>
  `,
  styles: [
    `
      .page {
        padding: 1.5rem 2rem;
        max-width: 960px;
      }
      .page-head {
        margin-bottom: 2rem;
      }
      .page-head h1 {
        font-size: 1.5rem;
        margin-bottom: 0.5rem;
      }
      code {
        background: #eef1f5;
        padding: 0.1rem 0.35rem;
        border-radius: 4px;
        font-size: 0.85em;
      }
      .block {
        margin-bottom: 2.5rem;
      }
      .block h2 {
        font-size: 1.1rem;
        margin-bottom: 0.75rem;
        padding-bottom: 0.4rem;
        border-bottom: 1px solid #e4e9f0;
      }
      .swatches {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 1rem;
      }
      .swatch-color {
        width: 100%;
        height: 48px;
        border-radius: 8px;
        margin-bottom: 0.4rem;
      }
      .swatch-label {
        display: flex;
        flex-direction: column;
        font-size: 0.82rem;
        gap: 0.15rem;
      }
      .type-scale p {
        margin-bottom: 0.5rem;
      }
      .t-xs {
        font-size: 11px;
      }
      .t-sm {
        font-size: 12px;
      }
      .t-md {
        font-size: 14px;
      }
      .t-lg {
        font-size: 16px;
        font-weight: 600;
      }
      .t-xl {
        font-size: 20px;
        font-weight: 700;
      }
      .scale-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .scale-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .scale-row code {
        width: 90px;
        flex: 0 0 auto;
      }
      .scale-bar {
        height: 14px;
        background: #1a5276;
        border-radius: 3px;
      }
      .radius-demo {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.8rem;
      }
      .radius-box {
        width: 64px;
        height: 64px;
        background: #ebf5fb;
        border: 2px solid #1a5276;
      }
      .row {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        align-items: center;
      }
      .row.col {
        flex-direction: column;
        align-items: flex-start;
      }
      .demo-card {
        max-width: 320px;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }
    `,
  ],
})
export class StyleGuideComponent {
  colors = COLORS;
  neutrals = NEUTRALS;
  spacing = SPACING;
  radii = RADII;
}
