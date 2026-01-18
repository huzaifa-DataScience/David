import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const GHL_MCP_URL = 'https://services.leadconnectorhq.com/mcp/';
const LOCATION_ID = process.env.GHL_LOCATION_ID;
const AUTH_TOKEN = process.env.GHL_AUTH_TOKEN;

if (!LOCATION_ID || !AUTH_TOKEN) {
  console.error('ERROR: GHL_LOCATION_ID and GHL_AUTH_TOKEN must be set');
  process.exit(1);
}

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'ghl-mcp-wrapper',
    locationId: LOCATION_ID ? 'configured' : 'missing'
  });
});

// SSE endpoint for MCP protocol
app.get('/sse', async (req, res) => {
  console.log('New SSE connection established');
  
  const transport = new SSEServerTransport('/messages', res);
  const server = new Server(
    {
      name: 'ghl-wrapper',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Axios instance with GHL auth
  const ghlClient = axios.create({
    baseURL: GHL_MCP_URL,
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      'locationId': LOCATION_ID,
      'Content-Type': 'application/json',
    },
  });

  // Helper function to inject locationId
  const injectLocationId = (args) => {
    if (!args) return { query_locationId: LOCATION_ID };
    
    const enriched = { ...args };
    
    // Check if any location parameter already exists
    const locationParams = [
      'query_locationId',
      'path_locationId', 
      'body_locationId',
      'locationId'
    ];
    
    const hasLocation = locationParams.some(param => param in enriched);
    
    if (!hasLocation) {
      // Determine parameter type based on existing keys
      const hasQuery = Object.keys(enriched).some(k => k.startsWith('query_'));
      const hasPath = Object.keys(enriched).some(k => k.startsWith('path_'));
      const hasBody = Object.keys(enriched).some(k => k.startsWith('body_'));
      
      if (hasQuery || (!hasPath && !hasBody)) {
        enriched.query_locationId = LOCATION_ID;
      } else if (hasPath) {
        enriched.path_locationId = LOCATION_ID;
      } else if (hasBody) {
        enriched.body_locationId = LOCATION_ID;
      }
    }
    
    return enriched;
  };

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    try {
      const response = await ghlClient.post('list_tools', {});
      return response.data;
    } catch (error) {
      console.error('Error listing tools:', error.message);
      return { tools: [] };
    }
  });

  // Call tool handler with auto-injection
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const { name, arguments: args } = request.params;
      
      console.log(`Tool call: ${name}`);
      
      // Auto-inject locationId
      const enrichedArgs = injectLocationId(args);
      
      console.log('Enriched args:', JSON.stringify(enrichedArgs, null, 2));
      
      // Forward to GHL MCP
      const response = await ghlClient.post('call_tool', {
        name,
        arguments: enrichedArgs,
      });
      
      return response.data;
    } catch (error) {
      console.error('Tool call error:', error.message);
      return {
        content: [
          {
            type: 'text',
            text: `Error calling tool: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  await server.connect(transport);
  console.log('MCP server connected via SSE');
});

// Message endpoint for MCP protocol
app.post('/messages', async (req, res) => {
  // This is handled by the SSE transport
  res.status(200).send();
});

app.listen(PORT, () => {
  console.log(`GHL MCP Wrapper listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
});