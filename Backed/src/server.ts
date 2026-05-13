import fastify from './app.js';

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000');
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Server running at http://localhost:${port}`);
    console.log(`API Documentation at http://localhost:${port}/docs`);

    const { cleanupExpiredReservations } = await import('./modules/checkout/service.js');
    setInterval(async () => {
      const count = await cleanupExpiredReservations(fastify.redis);
      if (count > 0) fastify.log.info(`Cancelled ${count} expired reservation(s)`);
    }, 5 * 60 * 1000);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
