import type { LanguageModelV3Middleware } from '@ai-sdk/provider';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import validationPrompt from '../instructions/input_validation_prompt.md?raw';

interface ValidationResult {
  allowed: boolean;
  reason: string;
}

export const inputGuardrailMiddleware: LanguageModelV3Middleware = {
  specificationVersion: 'v3',
  
  wrapGenerate: async ({ doGenerate }) => {
    const result = await doGenerate();

    return result;
  },

  wrapStream: async ({ doStream, params }) => {
    const prompt = params.prompt;

    // Filter out system messages and get last 3 user/assistant messages
    const conversationMessages = prompt.filter(
      (msg: any) => msg.role === 'user' || msg.role === 'assistant'
    ).slice(-3);

    // Only validate if there are user messages
    if (conversationMessages.length > 0) {
      try {
        // Make LLM validation call
        const validationResult = await generateText({
          model: openai('gpt-4o-mini'),
          messages: [
            { role: 'system', content: validationPrompt },
            ...conversationMessages.map((msg: any) => ({
              role: msg.role,
              content: typeof msg.content === 'string' 
                ? msg.content 
                : JSON.stringify(msg.content)
            }))
          ],
          temperature: 0.1,
        });

        // Parse the JSON response
        let validation: ValidationResult;
        try {
          // Extract JSON from response (in case there's markdown formatting)
          const jsonMatch = validationResult.text.match(/\{[\s\S]*\}/);
          const jsonText = jsonMatch ? jsonMatch[0] : validationResult.text;
          validation = JSON.parse(jsonText);
        } catch (parseError) {
          console.error('Failed to parse validation response:', validationResult.text);
          // If parsing fails, allow the request to proceed (fail open)
          validation = { allowed: true, reason: 'Validation parsing failed' };
        }

        // If not allowed, log and return predefined response stream
        if (!validation.allowed) {
          const lastUserMessage = conversationMessages
            .filter((msg: any) => msg.role === 'user')
            .slice(-1)[0];
          
          console.warn('Input guardrail rejected message:', {
            timestamp: new Date().toISOString(),
            reason: validation.reason,
            lastUserMessage: lastUserMessage?.content,
          });

          // Create predefined error message
          const errorMessage = `I appreciate your interest, but this question is outside the scope of what I can help with. I'm here to discuss Seppe's background, projects, and professional experience. ${validation.reason}`;
          
          // Create a synthetic stream using the same mechanism as successful responses
          const textBlockId = 'error-block-0';
          const errorStream = new ReadableStream({
            start(controller) {
              // Send text-start
              controller.enqueue({ type: 'text-start', id: textBlockId });
              
              // Send text-delta
              controller.enqueue({ type: 'text-delta', id: textBlockId, delta: errorMessage });
              
              // Send text-end
              controller.enqueue({ type: 'text-end', id: textBlockId });
              
              // Send finish
              controller.enqueue({ type: 'finish', finishReason: 'stop' });
              
              controller.close();
            }
          });

          // Apply the same transform logic as successful responses
          let generatedText = '';
          const textBlocks = new Map<string, string>();

          const transformStream = new TransformStream({
            transform(chunk: any, controller: any) {
              switch (chunk.type) {
                case 'text-start': {
                  textBlocks.set(chunk.id, '');
                  break;
                }
                case 'text-delta': {
                  const existing = textBlocks.get(chunk.id) || '';
                  textBlocks.set(chunk.id, existing + chunk.delta);
                  generatedText += chunk.delta;
                  break;
                }
                case 'text-end': {
                  console.log(
                    `Text block ${chunk.id} completed:`,
                    textBlocks.get(chunk.id),
                  );
                  break;
                }
              }

              controller.enqueue(chunk);
            },

            flush() {
              console.log('Error stream finished');
              console.log(`generated text: ${generatedText}`);
            },
          });

          return {
            stream: errorStream.pipeThrough(transformStream),
            rawCall: { rawPrompt: null, rawSettings: {} },
            rawResponse: { headers: {} },
            warnings: [],
            request: { body: '' }
          };
        }

        console.log('Input guardrail: message validated successfully');
      } catch (error) {
        // For validation errors (network, API issues), log and fail open
        console.error('Input guardrail validation error:', error);
        // Allow the request to proceed with original prompt
      }
    }

    // Only call doStream if we haven't already returned (validation passed or no messages)
    const {stream, ...rest} = await doStream();
    return {
        stream: stream,
        ...rest,
    };
  }
};