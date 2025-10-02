import cluster from 'cluster';
import os from 'os';
import express from 'express';
import pdf from 'pdf-parse/lib/pdf-parse.js';

const PORT = 3000;
const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} is running`);

  for (let i = 0; i < numCPUs; i++) cluster.fork();

  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} died. Spawning a new worker...`);
    cluster.fork();
  });

} else {
  const app = express();

  // Middleware to accept raw PDF data
  app.use('/convert', express.raw({ type: 'application/pdf', limit: '50mb' }));

  app.post('/convert', async (req, res) => {
    if (!req.body || req.body.length === 0) {
      return res.status(400).json({ error: 'No PDF data received' });
    }

    try {
      const data = await pdf(req.body, { max: 0 });

      const jsonOutput = {
        metadata: {
          title: data.info?.Title || 'N/A',
          author: data.info?.Author || 'N/A',
          creator: data.info?.Creator || 'N/A',
          producer: data.info?.Producer || 'N/A',
          creationDate: data.info?.CreationDate || 'N/A',
          modificationDate: data.info?.ModDate || 'N/A',
          pageCount: data.numpages
        },
        content: {
          fullText: data.text,
          textLength: data.text.length,
          wordCount: data.text.split(/\s+/).filter(w => w.length > 0).length
        },
        rawInfo: data.info
      };

      res.json(jsonOutput);

    } catch (error) {
      console.error('PDF parsing error:', error);
      res.status(500).json({ error: 'Failed to parse PDF', details: error.message });
    }
  });

  app.listen(PORT, () => {
    console.log(`Worker ${process.pid} running on http://localhost:${PORT}`);
  });
}
