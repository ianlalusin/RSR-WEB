'use server';

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { assertActor, type VerifiedActor } from '@/lib/server-auth';
import { adminAuth } from '@/lib/firebase-admin';

type ActorToken = string;

async function resolveActor(token: ActorToken): Promise<VerifiedActor> {
  return assertActor(token);
}

// ---- Helpers ----

function generateId(): string {
  return adminDb.collection('_').doc().id;
}

// ---- Campaign Actions ----

export interface CreateCampaignInput {
  url: string;
  title: string;
  description: string;
}

export async function createCampaign(data: CreateCampaignInput, actorToken: ActorToken) {
  try {
    const actor = await resolveActor(actorToken);
    const id = generateId();
    const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    await adminDb.collection('socmedCampaigns').doc(id).set({
      id,
      url: data.url,
      title: data.title,
      description: data.description || '',
      submitted_by: actor.uid,
      submitted_at: now,
      status: 'pending',
      manager_approved_by: null,
      manager_note: null,
      validator_approved_by: null,
      validator_note: null,
      rejected_by: null,
      rejection_reason: null,
      deadline: null,
      target_agents: null,
      subtasks: null,
      created_at: FieldValue.serverTimestamp(),
    });

    return { success: true, id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function approveCampaign(
  campaignId: string,
  role: 'manager' | 'validator',
  note: string,
  actorToken: ActorToken
) {
  try {
    const actor = await resolveActor(actorToken);
    const ref = adminDb.collection('socmedCampaigns').doc(campaignId);

    if (role === 'manager') {
      await ref.update({
        status: 'manager_approved',
        manager_approved_by: actor.uid,
        manager_note: note || null,
      });
    } else {
      await ref.update({
        status: 'validated',
        validator_approved_by: actor.uid,
        validator_note: note || null,
      });
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function rejectCampaign(
  campaignId: string,
  reason: string,
  actorToken: ActorToken
) {
  try {
    const actor = await resolveActor(actorToken);
    const ref = adminDb.collection('socmedCampaigns').doc(campaignId);

    await ref.update({
      status: 'rejected',
      rejected_by: actor.uid,
      rejection_reason: reason,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export interface SubtaskDef {
  type: string;
  instruction: string;
}

export async function rolloutCampaign(
  campaignId: string,
  subtasks: SubtaskDef[],
  targetAgentIds: string[],
  deadline: string,
  actorToken: ActorToken
) {
  try {
    const actor = await resolveActor(actorToken);

    // Check for existing submissions to make this idempotent
    const existingSnap = await adminDb.collection('socmedSubmissions')
      .where('campaign_id', '==', campaignId)
      .get();
    const existingKeys = new Set(
      existingSnap.docs.map(d => `${d.data().agent_id}__${d.data().subtask_type}`)
    );

    const batch = adminDb.batch();

    // Update the campaign
    const campaignRef = adminDb.collection('socmedCampaigns').doc(campaignId);
    batch.update(campaignRef, {
      status: 'active',
      subtasks: JSON.stringify(subtasks),
      target_agents: JSON.stringify(targetAgentIds),
      deadline,
    });

    // Create one submission per agent per subtask
    for (const agentId of targetAgentIds) {
      for (const subtask of subtasks) {
        const key = `${agentId}__${subtask.type}`;
        if (existingKeys.has(key)) continue;

        const subId = generateId();
        const subRef = adminDb.collection('socmedSubmissions').doc(subId);
        batch.set(subRef, {
          id: subId,
          campaign_id: campaignId,
          agent_id: agentId,
          subtask_type: subtask.type,
          subtask_instruction: subtask.instruction,
          status: 'pending',
          proof_url: null,
          proof_note: null,
          submitted_at: null,
          checked_by: null,
          checker_note: null,
          checked_at: null,
          created_at: FieldValue.serverTimestamp(),
        });
      }
    }

    await batch.commit();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ---- Submission Actions ----

export async function submitProof(
  submissionId: string,
  proofUrl: string,
  proofNote: string,
  actorToken: ActorToken
) {
  try {
    await resolveActor(actorToken);
    const ref = adminDb.collection('socmedSubmissions').doc(submissionId);

    await ref.update({
      status: 'submitted',
      proof_url: proofUrl,
      proof_note: proofNote || null,
      submitted_at: FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function checkSubmission(
  submissionId: string,
  newStatus: 'approved' | 'rejected' | 'flagged',
  checkerNote: string,
  actorToken: ActorToken
) {
  try {
    const actor = await resolveActor(actorToken);
    const ref = adminDb.collection('socmedSubmissions').doc(submissionId);

    await ref.update({
      status: newStatus,
      checker_note: checkerNote || null,
      checked_by: actor.uid,
      checked_at: FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ---- User Management Actions ----

export async function updateUserSocmedRole(
  userId: string,
  socmedRole: string | null,
  actorToken: ActorToken
) {
  try {
    await resolveActor(actorToken);
    const ref = adminDb.collection('users').doc(userId);

    await ref.update({
      socmedRole: socmedRole || null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createSocmedUser(
  displayName: string,
  email: string,
  password: string,
  socmedRole: string,
  actorToken: ActorToken
) {
  try {
    await resolveActor(actorToken);

    // Create Firebase Auth user via Admin SDK
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName,
    });

    // Create Firestore profile
    await adminDb.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      displayName,
      photoURL: null,
      isActive: true,
      socmedRole,
      access: {
        pages: { dashboard: { level: 'readonly' }, profile: { level: 'readonly' }, socmed: { level: 'readwrite' } },
        districtIds: [],
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true, uid: userRecord.uid };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function removeSocmedUser(
  userId: string,
  actorToken: ActorToken
) {
  try {
    await resolveActor(actorToken);
    const ref = adminDb.collection('users').doc(userId);

    await ref.update({
      socmedRole: null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
