// Mock Anthropic SDK for testing
export class MockAnthropic {
  constructor(config) {
    this.apiKey = config.apiKey;
  }

  messages = {
    create: async (params) => {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Return mock pattern based on input
      const mockPattern = `// Song: Test Song by Test Artist
// Tempo: 120
// Key: C major
// Structure: intro, verse, chorus, outro

setcps(120/60/4)

// Test pattern
let intro = stack(
  sound("bd*4"),
  sound("hh*8")
)

cat(
  intro.slow(4)
)`;

      return {
        content: [{
          text: mockPattern
        }]
      };
    }
  };
}

export function createMockAnthropic(apiKey) {
  return new MockAnthropic({ apiKey });
}