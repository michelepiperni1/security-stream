import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { simulator, start } from './simulator.js';
import type { AgentReport } from './simulator.js';
import { saveReport, saveDecision, getRecentHistory } from './db.js';
import { analyzeReport } from './agent.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

// --- SSE ---

const clients = new Set<{ write: (data: string) => void }>();

const broadcast = (event: string, data: unknown) => {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) client.write(payload);
};

simulator.on('report', (report: AgentReport) => {
  saveReport(report);
  broadcast('report', report);

  analyzeReport(report)
    .then(decision => {
      if (!decision) return;
      saveDecision(decision);
      broadcast('decision', decision);
    })
    .catch(err => app.log.error({ err }, 'Agent analysis failed'));
});

app.get('/events', (req, reply) => {
  const origin = req.headers.origin ?? '*';
  reply.raw.setHeader('Access-Control-Allow-Origin', origin);
  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.flushHeaders();

  const client = { write: (data: string) => reply.raw.write(data) };
  clients.add(client);

  req.raw.on('close', () => clients.delete(client));
});

// --- history ---

app.get('/history', () => getRecentHistory(100));

// --- health ---

app.get('/health', () => ({ ok: true }));

// --- boot ---

await app.listen({ port: 3000 });
console.log('Server running on http://localhost:3000');
start();
