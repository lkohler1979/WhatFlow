import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Express, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { parse as parseYaml } from 'yaml';
import { logger } from '@core/logger.js';

/**
 * Localiza o arquivo docs/WhatFlow_openapi.yaml.
 *
 * O YAML vive na raiz do monorepo (docs/) — fora de apps/api. Dependendo de
 * como a API é iniciada (tsx a partir de apps/api ou da raiz), a raiz relativa
 * muda. Testamos vários candidatos e usamos o primeiro que existir.
 * Pode ser sobrescrito por OPENAPI_SPEC_PATH.
 */
function findOpenApiSpec(): string | null {
  const candidates = [
    process.env.OPENAPI_SPEC_PATH,
    // A partir do cwd (normalmente apps/api quando roda via tsx)
    resolve(process.cwd(), '../../docs/WhatFlow_openapi.yaml'),
    resolve(process.cwd(), 'docs/WhatFlow_openapi.yaml'),
    // Fallback: um nível acima (caso o cwd seja apps/)
    resolve(process.cwd(), '../docs/WhatFlow_openapi.yaml'),
  ].filter((p): p is string => Boolean(p));

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Monta o Swagger UI em GET /docs e serve a spec JSON em GET /v1/openapi.json.
 *
 * Se o YAML não for encontrado (ex.: ausente no container), NÃO derruba o boot:
 * registra um warn e as rotas respondem 404 com mensagem amigável.
 */
export function setupSwagger(app: Express, apiPrefix = '/v1'): void {
  const specPath = findOpenApiSpec();

  if (!specPath) {
    logger.warn(
      'Spec OpenAPI (docs/WhatFlow_openapi.yaml) não encontrada — Swagger UI desabilitado.',
    );
    const notFound = (_req: Request, res: Response): void => {
      res.status(404).json({
        error: 'OpenAPI spec não disponível',
        code: 'OPENAPI_SPEC_NOT_FOUND',
        message:
          'O arquivo docs/WhatFlow_openapi.yaml não foi encontrado neste ambiente. ' +
          'Defina OPENAPI_SPEC_PATH ou disponibilize o arquivo.',
      });
    };
    app.get('/docs', notFound);
    app.get(`${apiPrefix}/openapi.json`, notFound);
    return;
  }

  let spec: unknown;
  try {
    spec = parseYaml(readFileSync(specPath, 'utf8'));
  } catch (err) {
    logger.error(
      { err, specPath },
      'Falha ao ler/parsear a spec OpenAPI — Swagger UI desabilitado.',
    );
    const errorHandler = (_req: Request, res: Response): void => {
      res.status(500).json({
        error: 'OpenAPI spec inválida',
        code: 'OPENAPI_SPEC_INVALID',
      });
    };
    app.get('/docs', errorHandler);
    app.get(`${apiPrefix}/openapi.json`, errorHandler);
    return;
  }

  app.get(`${apiPrefix}/openapi.json`, (_req, res) => {
    res.json(spec);
  });

  app.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(spec as swaggerUi.JsonObject, {
      customSiteTitle: 'WhatFlow API — Swagger',
    }),
  );

  logger.info({ specPath }, '📖 Swagger UI disponível em /docs');
}
