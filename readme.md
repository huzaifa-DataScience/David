# GHL MCP Remote Wrapper

Auto-injects locationId into all GoHighLevel API calls.

## Environment Variables

- `GHL_LOCATION_ID` - Your GHL location ID
- `GHL_AUTH_TOKEN` - Your GHL API token
- `PORT` - Server port (default: 3000)

## Deploy to Render

1. Push to GitHub
2. Create new Web Service on Render
3. Set environment variables
4. Deploy

## Local Testing
```bash
npm install
npm start
```

Visit http://localhost:3000/health to verify.