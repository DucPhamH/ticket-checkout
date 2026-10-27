import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from './document';

export const openApiRouter = Router();

// Raw spec for tools (Postman, code generators); Swagger UI for humans.
openApiRouter.get('/openapi.json', (_req, res) => {
  res.json(openApiDocument);
});

openApiRouter.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(openApiDocument, {
    customSiteTitle: 'Ticket Checkout API',
    swaggerOptions: { tryItOutEnabled: true },
  }),
);
