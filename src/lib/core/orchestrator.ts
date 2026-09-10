import { createDispute, getDispute } from './models';
import { startAutonomousDisputePipeline } from './pipeline';
import type { DisputeEvent } from '@/shared/schemas';
export async function handleDisputeEvent(event: DisputeEvent): Promise<void> {
    const existing = await getDispute(event.disputeId); if (existing) { if (existing.status === 'investigating') startAutonomousDisputePipeline(event.disputeId); return; }
    try { await createDispute({ ...event, status: 'investigating' }); } catch (e) { if (typeof e === 'object' && e !== null && 'code' in e && e.code === 11000) return; throw e; }
    startAutonomousDisputePipeline(event.disputeId);
}
