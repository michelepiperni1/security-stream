import Fastify from 'fastify';
import cors from '@fastify/cors';
import { simulator, start } from './simulator.js';
import type { AgentReport } from './simulator.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

// --- SSE ---

const clients = new Set<{ write: (data: string) => void }>();

simulator.on('report', (report: AgentReport) => {
  const payload = `data: ${JSON.stringify(report)}\n\n`;
  for (const client of clients) {
    client.write(payload);
  }
});

app.get('/events', (req, reply) => {
  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.flushHeaders();

  const client = { write: (data: string) => reply.raw.write(data) };
  clients.add(client);

  req.raw.on('close', () => clients.delete(client));
});

// --- health ---

app.get('/health', () => ({ ok: true }));

// --- boot ---

await app.listen({ port: 3000 });
console.log('Server running on http://localhost:3000');
start();
