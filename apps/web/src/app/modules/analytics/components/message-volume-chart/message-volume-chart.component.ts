import { Component, computed, input } from '@angular/core';
import type { Granularity, MessageSeriesPoint } from '../../analytics.service';

interface Bar {
  inX: number;
  outX: number;
  inY: number;
  outY: number;
  inH: number;
  outH: number;
  barW: number;
  label: string;
  inbound: number;
  outbound: number;
}

interface YTick {
  y: number;
  value: number;
}

/**
 * Gráfico de volume de mensagens desenhado com SVG inline (sem libs externas —
 * há fragilidade de build conhecida no repo). Barras agrupadas inbound/outbound
 * por bucket, com eixos mínimos, grade horizontal e legenda.
 */
@Component({
  selector: 'wf-message-volume-chart',
  standalone: true,
  template: `
    <div class="chart">
      <div class="legend">
        <span class="key"><i class="swatch in"></i> Recebidas (inbound)</span>
        <span class="key"><i class="swatch out"></i> Enviadas (outbound)</span>
      </div>

      @if (points().length === 0) {
        <p class="empty">Sem mensagens no período selecionado.</p>
      } @else {
        <svg
          [attr.viewBox]="'0 0 ' + W + ' ' + H"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Volume de mensagens recebidas e enviadas por período"
        >
          <!-- grade + eixo Y -->
          @for (t of yTicks(); track t.value) {
            <line
              class="grid"
              [attr.x1]="padL"
              [attr.x2]="W - padR"
              [attr.y1]="t.y"
              [attr.y2]="t.y"
            />
            <text class="ytxt" [attr.x]="padL - 8" [attr.y]="t.y + 4" text-anchor="end">
              {{ t.value }}
            </text>
          }

          <!-- eixo X -->
          <line
            class="axis"
            [attr.x1]="padL"
            [attr.x2]="W - padR"
            [attr.y1]="baseY"
            [attr.y2]="baseY"
          />

          <!-- barras -->
          @for (b of bars(); track b.label) {
            <rect
              class="bar in"
              [attr.x]="b.inX"
              [attr.y]="b.inY"
              [attr.width]="b.barW"
              [attr.height]="b.inH"
            >
              <title>{{ b.label }} — recebidas: {{ b.inbound }}</title>
            </rect>
            <rect
              class="bar out"
              [attr.x]="b.outX"
              [attr.y]="b.outY"
              [attr.width]="b.barW"
              [attr.height]="b.outH"
            >
              <title>{{ b.label }} — enviadas: {{ b.outbound }}</title>
            </rect>
            <text class="xtxt" [attr.x]="b.inX + b.barW" [attr.y]="baseY + 16" text-anchor="middle">
              {{ b.label }}
            </text>
          }
        </svg>
      }
    </div>
  `,
  styles: [
    `
      .chart {
        width: 100%;
      }
      .legend {
        display: flex;
        gap: 1.25rem;
        font-size: 0.8rem;
        margin-bottom: 0.5rem;
        flex-wrap: wrap;
      }
      .key {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        opacity: 0.85;
      }
      .swatch {
        width: 12px;
        height: 12px;
        border-radius: 3px;
        display: inline-block;
      }
      .swatch.in {
        background: #2563eb;
      }
      .swatch.out {
        background: #16a34a;
      }
      svg {
        width: 100%;
        height: auto;
        display: block;
      }
      .grid {
        stroke: #e5e7eb;
        stroke-width: 1;
      }
      .axis {
        stroke: #9ca3af;
        stroke-width: 1;
      }
      .ytxt,
      .xtxt {
        fill: #6b7280;
        font-size: 11px;
      }
      .bar.in {
        fill: #2563eb;
      }
      .bar.out {
        fill: #16a34a;
      }
      .empty {
        opacity: 0.6;
        padding: 2rem 0;
        text-align: center;
      }
    `,
  ],
})
export class MessageVolumeChartComponent {
  points = input.required<MessageSeriesPoint[]>();
  granularity = input<Granularity>('day');

  // Geometria do viewBox (coordenadas internas; o SVG escala via width:100%).
  readonly W = 720;
  readonly H = 320;
  readonly padL = 40;
  readonly padR = 16;
  readonly padT = 12;
  readonly padB = 28;
  readonly baseY = this.H - this.padB;

  private maxVal = computed(() => {
    const pts = this.points();
    const m = Math.max(0, ...pts.map(p => Math.max(p.inbound, p.outbound)));
    return m === 0 ? 1 : m;
  });

  yTicks = computed<YTick[]>(() => {
    const max = this.niceMax();
    const steps = 4;
    const ticks: YTick[] = [];
    for (let i = 0; i <= steps; i++) {
      const value = Math.round((max / steps) * i);
      const y = this.baseY - (value / max) * (this.baseY - this.padT);
      ticks.push({ y, value });
    }
    return ticks;
  });

  bars = computed<Bar[]>(() => {
    const pts = this.points();
    if (pts.length === 0) return [];
    const max = this.niceMax();
    const plotW = this.W - this.padL - this.padR;
    const plotH = this.baseY - this.padT;
    const slot = plotW / pts.length;
    const barW = Math.max(4, Math.min(28, (slot * 0.7) / 2));
    const gap = 2;

    return pts.map((p, i) => {
      const center = this.padL + slot * i + slot / 2;
      const inX = center - barW - gap / 2;
      const outX = center + gap / 2;
      const inH = (p.inbound / max) * plotH;
      const outH = (p.outbound / max) * plotH;
      return {
        inX,
        outX,
        inY: this.baseY - inH,
        outY: this.baseY - outH,
        inH,
        outH,
        barW,
        inbound: p.inbound,
        outbound: p.outbound,
        label: this.formatBucket(p.bucket),
      };
    });
  });

  private niceMax(): number {
    const max = this.maxVal();
    const pow = Math.pow(10, Math.floor(Math.log10(max)));
    return Math.ceil(max / pow) * pow;
  }

  private formatBucket(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}`;
  }
}
