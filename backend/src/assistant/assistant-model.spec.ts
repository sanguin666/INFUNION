import type { ConfigService } from '@nestjs/config';
import { AssistantModel } from './assistant-model.js';

const config = (values: Record<string, string>) => ({ get: (key: string) => values[key] }) as unknown as ConfigService;

describe('AssistantModel', () => {
  it('is on with a key, off without one', () => {
    expect(new AssistantModel(config({ ANTHROPIC_API_KEY: 'k' })).enabled).toBe(true);
    expect(new AssistantModel(config({})).enabled).toBe(false);
  });

  it('is off with ASSISTANT=off, whatever the key', () => {
    expect(new AssistantModel(config({ ANTHROPIC_API_KEY: 'k', ASSISTANT: ' OFF ' })).enabled).toBe(false);
    expect(new AssistantModel(config({ ANTHROPIC_API_KEY: 'k', ASSISTANT: 'on' })).enabled).toBe(true);
  });
});
