const fs = require('fs');
const pdfParse = require('pdf-parse');
const { OpenAI } = require('openai');
const { Pinecone } = require('@pinecone-database/pinecone');

// Config (replace with your keys)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.index('mita-legal'); // Create index in Pinecone

async function extractTextFromPDF(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text;
}

function chunkText(text, chunkSize = 1000) {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

async function generateEmbedding(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text,
  });
  return response.data[0].embedding;
}

async function ingestDocument(filePath, metadata) {
  console.log('Extracting text from PDF...');
  const text = await extractTextFromPDF(filePath);

  console.log('Chunking text...');
  const chunks = chunkText(text);

  console.log(`Processing ${chunks.length} chunks...`);
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = await generateEmbedding(chunk);

    const vector = {
      id: `${metadata.title}-chunk-${i}`,
      values: embedding,
      metadata: {
        ...metadata,
        chunkIndex: i,
        text: chunk,
      },
    };

    await index.upsert([vector]);
    console.log(`Upserted chunk ${i + 1}/${chunks.length}`);
  }

  console.log('Ingestion complete!');
}

// Usage
const constitutionMetadata = {
  title: 'The Constitution of the United Republic of Tanzania of 1977',
  source_url: 'https://oagmis.oag.go.tz/portal/constitutions/eyJpdiI6Ijd4VVkzN0hYeHRkMkUrU3NhelRYOGc9PSIsInZhbHVlIjoib1p6dTRLK0ZzbDAxQ1hEYXVpSUZ0dz09IiwibWFjIjoiZDBiNzJmOGY3MDg3YTZiM2I4ZTA2NDIyNDZlZjU2ZmQzODkxOTBlY2E1MzQ1NmQyZGM3NGI3MDI4ZDk2MDAwYyJ9',
  local_path: 'docs/Legal URT/THE CONSTITUTION OF THE UNITED REPUBLIC OF TANZANIA OF 1977.pdf',
  fetched_at: '2025-10-30T00:00:00Z',
  sha256: 'd27a2826a8d18a55dd87365ad53c97df8b0f1a744ee905180487b339c8cfa1e6',
  license: 'public-domain / government-publication',
};

ingestDocument(constitutionMetadata.local_path, constitutionMetadata).catch(console.error);