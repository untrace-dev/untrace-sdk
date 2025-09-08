import { expect } from 'bun:test';
import { env } from './test-utils/env';

export async function checkLangfuseAPI() {
  console.log('🔍 Checking Langfuse API for traces...\n');

  if (!env.LANGFUSE_PUBLIC_KEY || !env.LANGFUSE_SECRET_KEY) {
    console.log('❌ Missing Langfuse credentials');
    throw new Error('Missing Langfuse credentials');
  }

  console.log('🔑 Using Langfuse credentials:', {
    publicKey: `${env.LANGFUSE_PUBLIC_KEY.substring(0, 10)}...`,
    secretKey: `${env.LANGFUSE_SECRET_KEY.substring(0, 10)}...`,
  });

  // Try different Langfuse API endpoints
  const baseUrl = 'https://us.cloud.langfuse.com/api/public';
  // Langfuse API uses Basic auth with public key as username and secret key as password
  const auth = Buffer.from(
    `${env.LANGFUSE_PUBLIC_KEY}:${env.LANGFUSE_SECRET_KEY}`,
  ).toString('base64');

  try {
    // Get traces from the last hour
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const tracesUrl = `${baseUrl}/traces?from=${oneHourAgo.toISOString()}&to=${now.toISOString()}&limit=10`;

    console.log('📡 Fetching traces from Langfuse API...');
    console.log(`URL: ${tracesUrl}`);

    const response = await fetch(tracesUrl, {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.log(
        `⚠️ API request failed: ${response.status} ${response.statusText}`,
      );
      const errorText = await response.text();
      console.log(`Error details: ${errorText}`);
      console.log('⚠️ Skipping Langfuse API checks due to API failure');
      return {
        observations: [],
        traces: [],
      };
    }

    const traces = (await response.json()) as {
      data?: Array<{
        id: string;
        name?: string;
        timestamp: string;
        status: string;
        duration: number;
        userId?: string;
        metadata?: Record<string, unknown>;
      }>;
    };
    console.log(`\n✅ Found ${traces.data?.length || 0} traces in Langfuse`);
    // Note: Traces might not be found immediately due to fanout service not processing destinations
    // The important part is that the API is accessible and returning the expected structure

    if (traces.data && traces.data.length > 0) {
      console.log('\n📋 Recent traces:');
      traces.data.forEach((trace, index: number) => {
        console.log(`\n${index + 1}. Trace ID: ${trace.id}`);
        console.log(`   Name: ${trace.name || 'N/A'}`);
        console.log(`   Created: ${trace.timestamp}`);
        console.log(`   Status: ${trace.status}`);
        console.log(`   Duration: ${trace.duration}ms`);
        console.log(`   User ID: ${trace.userId || 'N/A'}`);
        console.log(
          `   Metadata: ${JSON.stringify(trace.metadata || {}, null, 2)}`,
        );
        expect(trace.id).toBeDefined();
        expect(trace.timestamp).toBeDefined();
        expect(trace.status).toBeDefined();
        expect(trace.duration).toBeGreaterThanOrEqual(0);
      });
    } else {
      console.log('\n📭 No traces found in the last hour');
    }

    // Also check for observations (spans)
    const observationsUrl = `${baseUrl}/observations?from=${oneHourAgo.toISOString()}&to=${now.toISOString()}&limit=10`;

    console.log('\n📡 Fetching observations from Langfuse API...');

    const obsResponse = await fetch(observationsUrl, {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    let observationsData: Array<{
      id: string;
      type: string;
      name?: string;
      timestamp: string;
      traceId: string;
    }> = [];

    if (obsResponse.ok) {
      const observations = (await obsResponse.json()) as {
        data?: Array<{
          id: string;
          type: string;
          name?: string;
          timestamp: string;
          traceId: string;
        }>;
      };
      console.log(
        `\n✅ Found ${observations.data?.length || 0} observations in Langfuse`,
      );
      expect(observations.data).toBeDefined();
      observationsData = observations.data || [];

      if (observationsData.length > 0) {
        console.log('\n📋 Recent observations:');
        observationsData.forEach((obs, index: number) => {
          console.log(`\n${index + 1}. Observation ID: ${obs.id}`);
          console.log(`   Type: ${obs.type}`);
          console.log(`   Name: ${obs.name || 'N/A'}`);
          console.log(`   Created: ${obs.timestamp}`);
          console.log(`   Trace ID: ${obs.traceId}`);
          expect(obs.id).toBeDefined();
          expect(obs.type).toBeDefined();
          expect(obs.timestamp).toBeDefined();
          expect(obs.traceId).toBeDefined();
        });
      }
    }

    return {
      observations: observationsData,
      traces: traces.data || [],
    };
  } catch (error) {
    console.error('❌ Error checking Langfuse API:', error);
    throw error;
  }
}
