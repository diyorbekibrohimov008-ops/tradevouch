// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LandingPage } from '../src/pages/LandingPage';
import { CollectorPage } from '../src/pages/CollectorPage';
import { StudioPage } from '../src/pages/StudioPage';
import { MemoryStore } from '../server/memoryStore';
import { seedDemoData } from '../server/seed';
import { createApp } from '../server/app';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function createTestFetchBridge() {
  const store = new MemoryStore();
  await seedDemoData(store, 'http://localhost');
  const app = createApp(store);

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const path = url.startsWith('http') ? new URL(url).pathname + new URL(url).search : url;
    return app.request(path, init);
  });
}

describe('TradeVouch UI', () => {
  it('renders LandingPage pricing positioning and interactive Voice-to-Review demo', async () => {
    const onNavigate = vi.fn();
    const onOpenAuth = vi.fn();

    render(<LandingPage onNavigate={onNavigate} onOpenAuth={onOpenAuth} />);

    expect(screen.getAllByText(/\$29\/mo flat/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/NiceJob/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Birdeye/i).length).toBeGreaterThanOrEqual(1);

    // Switch hero demo widget to 2 Quick Questions and generate review
    fireEvent.click(screen.getByRole('button', { name: /2 Quick Questions/i }));
    fireEvent.click(screen.getByRole('button', { name: /On-time arrival/i }));
    expect(screen.getAllByText(/Marcus Vance/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /Copy Review & Open Google Maps/i })).toBeInTheDocument();
  });

  it('runs homeowner 2-question review flow in CollectorPage against real backend routes', async () => {
    const fetchBridge = await createTestFetchBridge();
    vi.stubGlobal('fetch', fetchBridge);
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    vi.stubGlobal('open', vi.fn());

    render(<CollectorPage token="rv_demo_okafor" onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Tom/i)).toBeInTheDocument();
    });

    // Tap 5-star rating
    fireEvent.click(screen.getByRole('button', { name: /5 stars/i }));

    // Switch to 2 Quick Questions
    fireEvent.click(screen.getByRole('button', { name: /2 Quick Questions/i }));
    fireEvent.click(screen.getByRole('button', { name: /On-time arrival/i }));
    fireEvent.click(screen.getByRole('button', { name: /Clear upfront quote/i }));
    fireEvent.click(screen.getByRole('button', { name: /Draft My Review/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Copy Review & Open Google Maps/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Copy Review & Open Google Maps/i }));
    await waitFor(() => {
      expect(screen.getByText(/Copied to clipboard/i)).toBeInTheDocument();
    });
  });

  it('loads StudioPage demo workspace and simulates a Jobber job-completed webhook', async () => {
    const fetchBridge = await createTestFetchBridge();
    vi.stubGlobal('fetch', fetchBridge);

    render(
      <StudioPage
        authToken={null}
        onNavigate={vi.fn()}
        onOpenAuth={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /PeakLine Roofing & Exteriors/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /CRM Sync & Webhooks/i }));
    fireEvent.click(screen.getByRole('button', { name: /Simulate Jobber Job/i }));

    await waitFor(() => {
      expect(screen.getByText(/Jobber webhook processed/i)).toBeInTheDocument();
    });
  });
});
