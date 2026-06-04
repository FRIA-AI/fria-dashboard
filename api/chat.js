// NORA Chat API — with Tool Calling support
// Read-only tools execute immediately, write tools require approval

const NORA_TOOLS = [
  {
    name: 'show_action_plan',
    description: `Use this tool BEFORE executing any action that MODIFIES data or triggers workflows.
Present a clear plan of what you are about to do and wait for user approval.
Use ONLY for: adding/updating carriers, creating rates, triggering RFQs, modifying workflows.
Do NOT use for read-only queries like get_quotes_by_lane.`,
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
    description: 'Trigger an RFQ to carriers via n8n Workflow 1. Requires show_action_plan first.',
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
    description: `READ-ONLY. Query Airtable for quotes and rates on a specific lane. 
Execute this tool DIRECTLY without asking for approval — it only reads data, never modifies anything.
Use this whenever the user asks about rates, prices, quotes, or carrier comparisons for a lane.`,
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
    description: 'Save a new rate to Historical Rates in Airtable. Requires show_action_plan first.',
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
    description: 'Add a new carrier to the Carriers table in Airtable. Requires show_action_plan first.',
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
    description: 'Update an existing carrier record in Airtable. Requires show_action_plan first.',
    input_schema: {
      type: 'object',
      properties: {
        carrierName: { type: 'string', description: 'Name to find the carrier' },
        fields: { type: 'object', description: 'Fields to update as key-value pairs' },
      },
      required: ['carrierName', 'fields'],
    },
  },
  {
    name: 'execute_n8n_workflow',
    description: 'Trigger a specific n8n workflow via webhook. Requires show_action_plan first.',
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

// Tools that execute immediately without user approval
const READ_ONLY_TOOLS = ['get_quotes_by_lane'];

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

    // If user approved a write tool call, inject the tool result
    if (approved_tool_call) {
      const toolResult = await executeToolCall(approved_tool_call);
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
        model: 'claude-sonnet-4-6',
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

    const toolUseBlock = data.content?.find(b => b.type === 'tool_use');
    const textBlock = data.content?.find(b => b.type === 'text');

    if (toolUseBlock) {

      // READ-ONLY tools: execute immediately, send result back to Claude for natural response
      if (READ_ONLY_TOOLS.includes(toolUseBlock.name)) {
        const toolResult = await executeToolCall({
          tool_use_id: toolUseBlock.id,
          name: toolUseBlock.name,
          input: toolUseBlock.input,
        });

        const followUpMessages = [
          ...messages,
          { role: 'assistant', content: data.content },
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: toolUseBlock.id,
                content: JSON.stringify(toolResult),
              },
            ],
          },
        ];

        const followUp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 4096,
            system: system,
            tools: NORA_TOOLS,
            messages: followUpMessages,
          }),
        });

        const followUpData = await followUp.json();
        const finalText = followUpData.content?.find(b => b.type === 'text')?.text || 'No results found.';
        return res.status(200).json({ type: 'text', text: finalText });
      }

      // show_action_plan: return plan to frontend for user approval
      if (toolUseBlock.name === 'show_action_plan') {
        return res.status(200).json({
          type: 'action_plan',
          plan: toolUseBlock.input,
          tool_use_id: toolUseBlock.id,
          pending_tool: null,
          text: textBlock?.text || null,
        });
      }

      // All other write tools: require approval
      return res.status(200).json({
        type: 'pending_approval',
        tool_name: toolUseBlock.name,
        tool_input: toolUseBlock.input,
        tool_use_id: toolUseBlock.id,
        text: textBlock?.text || `Ready to execute: **${toolUseBlock.name}**`,
      });
    }

    // Normal text response
    const text = textBlock?.text || 'Sorry, I could not process that.';
    return res.status(200).json({ type: 'text', text });

  } catch (error) {
    console.error('Chat handler error:', error);
    return res.status(500).json({ error: 'Failed to process request', details: error.message });
  }
}

// Execute a tool call
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
