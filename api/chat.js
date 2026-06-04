// NORA Chat API — with Tool Calling support
// Tools: request_quote, get_quotes_by_lane, add_carrier, update_carrier,
//        create_historical_rate, execute_n8n_workflow, show_action_plan

const NORA_TOOLS = [
  {
    name: 'show_action_plan',
    description: `Use this tool BEFORE executing any action that modifies data or triggers workflows.
Present a clear plan of what you are about to do and wait for user approval.
Always use this when: adding/updating carriers, creating rates, triggering RFQs, modifying workflows.`,
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short title of the action plan' },
        steps: {
          type: 'array',
          description: 'List of steps NORA will execute',
          items: {
            type: 'object',
            properties: {
              step: { type: 'number' },
              action: { type: 'string', description: 'What will be done' },
              target: { type: 'string', description: 'Where (Airtable table, n8n workflow, etc.)' },
              details: { type: 'string', description: 'Specific data or changes' },
            },
            required: ['step', 'action', 'target', 'details'],
          },
        },
        warning: { type: 'string', description: 'Optional: any risk or irreversible action to highlight' },
      },
      required: ['title', 'steps'],
    },
  },
  {
    name: 'request_quote',
    description: 'Trigger an RFQ to carriers via n8n Workflow 1. Use after user approves the action plan.',
    input_schema: {
      type: 'object',
      properties: {
        origin: { type: 'string', description: 'Origin city/location' },
        destination: { type: 'string', description: 'Destination city/location' },
        equipment: { type: 'string', description: 'Equipment type (e.g. Dry Van, Torton, 53ft Flatbed)' },
        notes: { type: 'string', description: 'Additional notes or special requirements' },
        userEmail: { type: 'string', description: 'Email to send analysis to' },
      },
      required: ['origin', 'destination', 'equipment'],
    },
  },
  {
    name: 'get_quotes_by_lane',
    description: 'Query Airtable Quotes table filtered by origin and/or destination.',
    input_schema: {
      type: 'object',
      properties: {
        origin: { type: 'string' },
        destination: { type: 'string' },
        equipment: { type: 'string' },
        limit: { type: 'number', description: 'Max records to return, default 20' },
      },
    },
  },
  {
    name: 'create_historical_rate',
    description: 'Save a new rate to Historical Rates in Airtable. Use after user approves.',
    input_schema: {
      type: 'object',
      properties: {
        carrierName: { type: 'string' },
        origin: { type: 'string' },
        destination: { type: 'string' },
        equipment: { type: 'string' },
        price: { type: 'number' },
        currency: { type: 'string', enum: ['MXN', 'USD'] },
        transitTime: { type: 'string' },
        validFrom: { type: 'string', description: 'YYYY-MM-DD' },
        validTo: { type: 'string', description: 'YYYY-MM-DD' },
        source: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['carrierName', 'origin', 'destination', 'equipment', 'price', 'currency'],
    },
  },
  {
    name: 'add_carrier',
    description: 'Add a new carrier to the Carriers table in Airtable. Use after user approves.',
    input_schema: {
      type: 'object',
      properties: {
        carrierName: { type: 'string' },
        equipmentTypes: { type: 'array', items: { type: 'string' } },
        yards: { type: 'string' },
        serviceType: { type: 'array', items: { type: 'string' } },
        mainContact: { type: 'string' },
        mainEmail: { type: 'string' },
        ccContact: { type: 'string' },
        ccEmail: { type: 'string' },
        language: { type: 'string', enum: ['Spanish', 'English', 'Both'] },
        notes: { type: 'string' },
      },
      required: ['carrierName', 'mainEmail'],
    },
  },
  {
    name: 'update_carrier',
    description: 'Update an existing carrier record in Airtable. Use after user approves.',
    input_schema: {
      type: 'object',
      properties: {
        carrierName: { type: 'string', description: 'Name to find the carrier' },
        fields: {
          type: 'object',
          description: 'Fields to update as key-value pairs',
        },
      },
      required: ['carrierName', 'fields'],
    },
  },
  {
    name: 'execute_n8n_workflow',
    description: 'Trigger a specific n8n workflow via webhook. Use after user approves.',
    input_schema: {
      type: 'object',
      properties: {
        workflowName: {
          type: 'string',
          enum: ['rfq', 'tarifarios'],
          description: 'Which workflow to trigger',
        },
        payload: { type: 'object', description: 'Data to send to the workflow' },
      },
      required: ['workflowName', 'payload'],
    },
  },
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { history, system, approved_tool_call } = req.body;

    let messages = (history || []).filter(m => m.role === 'user' || m.role === 'assistant');
    while (messages.length > 0 && messages[0].role === 'assistant') {
      messages = messages.slice(1);
    }
    if (messages.length === 0) {
      return res.status(400).json({ error: 'No messages provided' });
    }

    // If user approved a pending tool call, inject the tool result
    if (approved_tool_call) {
      const toolResult = await executeToolCall(approved_tool_call);
      // Append tool_use + tool_result to messages so Claude can summarize
      messages = [
        ...messages,
        {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: approved_tool_call.tool_use_id,
              name: approved_tool_call.name,
              input: approved_tool_call.input,
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: approved_tool_call.tool_use_id,
              content: JSON.stringify(toolResult),
            },
          ],
        },
      ];
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: system,
        tools: NORA_TOOLS,
        messages: messages,
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('Anthropic error:', data.error);
      return res.status(500).json({ error: data.error.message });
    }

    // Check if Claude wants to use a tool
    const toolUseBlock = data.content?.find(b => b.type === 'tool_use');
    const textBlock = data.content?.find(b => b.type === 'text');

    if (toolUseBlock) {
      if (toolUseBlock.name === 'show_action_plan') {
        // Return plan to frontend for user approval — don't execute yet
        return res.status(200).json({
          type: 'action_plan',
          plan: toolUseBlock.input,
          tool_use_id: toolUseBlock.id,
          pending_tool: null, // no execution needed for show_action_plan
          text: textBlock?.text || null,
        });
      } else {
        // For all other tools: return to frontend asking for approval
        return res.status(200).json({
          type: 'pending_approval',
          tool_name: toolUseBlock.name,
          tool_input: toolUseBlock.input,
          tool_use_id: toolUseBlock.id,
          text: textBlock?.text || `Ready to execute: **${toolUseBlock.name}**`,
        });
      }
    }

    // Normal text response
    const text = textBlock?.text || 'Sorry, I could not process that.';
    return res.status(200).json({ type: 'text', text });

  } catch (error) {
    console.error('Chat handler error:', error);
    return res.status(500).json({ error: 'Failed to process request', details: error.message });
  }
}

// Execute a tool call after user approval
async function executeToolCall(toolCall) {
  const { name, input } = toolCall;
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  try {
    const res = await fetch(`${baseUrl}/api/nora-actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: name, input }),
    });
    return await res.json();
  } catch (err) {
    return { error: err.message };
  }
}
