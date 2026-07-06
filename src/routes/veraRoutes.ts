import { Router } from 'express';
import { createVeraController } from '../controllers/veraController.js';
import { ContextStore } from '../storage/contextStore.js';
import { DecisionService } from '../services/decisionService.js';

export function createVeraRoutes() {
  const router = Router();
  const store = new ContextStore();
  const decisionService = new DecisionService(store);
  const controller = createVeraController(store, decisionService);

  router.get('/healthz', controller.health);
  router.get('/metadata', controller.metadata);
  router.post('/context', controller.context);
  router.post('/tick', controller.tick);
  router.post('/reply', controller.reply);

  return router;
}
