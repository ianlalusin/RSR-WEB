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

function canValidate(actor: VerifiedActor): boolean {
  const role = actor.profile?.socmedRole;
  return actor.isPlatformAdmin || role === 'Admin' || role === 'Manager' || role === 'Validator';
}

function canManageUsers(actor: VerifiedActor): boolean {
  const role = actor.profile?.socmedRole;
  return actor.isPlatformAdmin || role === 'Admin' || role === 'Manager';
}

function canCheck(actor: VerifiedActor): boolean {
  const role = actor.profile?.socmedRole;
  return actor.isPlatformAdmin
    || role === 'Admin'
    || role === 'Manager'
    || role === 'Validator'
    || role === 'Checker';
}

interface SubtaskItem {
  type: string;
  instruction: string;
  status: 'pending' | 'done' | 'passed' | 'failed';
  failure_reason: string | null;
  checked_by: string | null;
  checked_at: any;
}

function deriveOverallStatus(subtasks: SubtaskItem[], hasProof: boolean): 'pending' | 'in_progress' | 'submitted' | 'passed' | 'failed' {
  if (subtasks.length === 0) return 'pending';
  const someFailed = subtasks.some(st => st.status === 'failed');
  const allPassed = subtasks.every(st => st.status === 'passed');
  const allDoneOrGraded = subtasks.every(st => st.status === 'done' || st.status === 'passed' || st.status === 'failed');
  const allPending = subtasks.every(st => st.status === 'pending');

  if (allPassed) return 'passed';
  if (hasProof && someFailed) return 'failed';
  if (hasProof) return 'submitted';
  if (allPending) return 'pending';
  if (allDoneOrGraded) return 'in_progress';
  return 'in_progress';
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
  note: string,
  actorToken: ActorToken
) {
  try {
    const actor = await resolveActor(actorToken);
    if (!canValidate(actor)) {
      return { success: false, error: 'Permission denied. Only Admin, Manager, or Validator can validate.' };
    }

    const ref = adminDb.collection('socmedCampaigns').doc(campaignId);
    const result = await adminDb.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) return { ok: false, error: 'Campaign not found.' };
      const data = snap.data()!;
      if (data.status === 'validated' || data.status === 'active' || data.status === 'completed') {
        return { ok: false, error: 'Campaign already validated.' };
      }
      if (data.status === 'rejected') {
        return { ok: false, error: 'Campaign was rejected.' };
      }
      tx.update(ref, {
        status: 'validated',
        validator_approved_by: actor.uid,
        validator_note: note || null,
        validated_at: FieldValue.serverTimestamp(),
      });
      return { ok: true };
    });

    if (!result.ok) return { success: false, error: result.error };
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
    if (!canValidate(actor)) {
      return { success: false, error: 'Permission denied. Only Admin, Manager, or Validator can reject.' };
    }
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

export async function deleteCampaign(campaignId: string, actorToken: ActorToken) {
  try {
    const actor = await resolveActor(actorToken);
    if (!canManageUsers(actor)) {
      return { success: false, error: 'Permission denied. Only Admin or Manager can delete campaigns.' };
    }

    const subsSnap = await adminDb.collection('socmedSubmissions')
      .where('campaign_id', '==', campaignId).get();
    const batch = adminDb.batch();
    for (const doc of subsSnap.docs) batch.delete(doc.ref);
    batch.delete(adminDb.collection('socmedCampaigns').doc(campaignId));
    await batch.commit();

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export interface SubtaskDef {
  type: string;
  instruction: string;
}

function buildSubtaskItems(defs: SubtaskDef[]): SubtaskItem[] {
  return defs.map(d => ({
    type: d.type,
    instruction: d.instruction,
    status: 'pending',
    failure_reason: null,
    checked_by: null,
    checked_at: null,
  }));
}

export async function rolloutCampaign(
  campaignId: string,
  subtasks: SubtaskDef[],
  targetAgentIds: string[],
  deadline: string,
  requireScreenshot: boolean,
  allowMultipleUrls: boolean,
  actorToken: ActorToken
) {
  try {
    const actor = await resolveActor(actorToken);
    if (!canValidate(actor)) {
      return { success: false, error: 'Permission denied. Only Admin, Manager, or Validator can roll out campaigns.' };
    }

    // Existing submissions for this campaign keyed by agent_id (new shape: one per agent)
    const existingSnap = await adminDb.collection('socmedSubmissions')
      .where('campaign_id', '==', campaignId)
      .get();

    const batch = adminDb.batch();

    // Delete legacy per-(agent,subtask) submissions that don't match the new (agent) keying.
    // New-shape submissions have a `subtasks` array; legacy ones have `subtask_type`.
    const existingByAgent = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    for (const doc of existingSnap.docs) {
      const data = doc.data();
      if (Array.isArray(data.subtasks)) {
        existingByAgent.set(data.agent_id, doc);
      } else {
        batch.delete(doc.ref);
      }
    }

    const campaignRef = adminDb.collection('socmedCampaigns').doc(campaignId);
    batch.update(campaignRef, {
      status: 'active',
      subtasks: JSON.stringify(subtasks),
      target_agents: JSON.stringify(targetAgentIds),
      deadline,
      require_screenshot: !!requireScreenshot,
      allow_multiple_urls: !!allowMultipleUrls,
    });

    const freshSubtasks = buildSubtaskItems(subtasks);
    for (const agentId of targetAgentIds) {
      if (existingByAgent.has(agentId)) continue;
      const subId = generateId();
      const subRef = adminDb.collection('socmedSubmissions').doc(subId);
      batch.set(subRef, {
        id: subId,
        campaign_id: campaignId,
        agent_id: agentId,
        subtasks: freshSubtasks,
        proof_urls: null,
        proof_screenshot_url: null,
        proof_note: null,
        submitted_at: null,
        overall_status: 'pending',
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function editRollout(
  campaignId: string,
  subtasks: SubtaskDef[],
  targetAgentIds: string[],
  deadline: string,
  requireScreenshot: boolean,
  allowMultipleUrls: boolean,
  actorToken: ActorToken
) {
  try {
    const actor = await resolveActor(actorToken);
    if (!canValidate(actor)) {
      return { success: false, error: 'Permission denied. Only Admin, Manager, or Validator can edit rollouts.' };
    }

    const desiredAgentSet = new Set(targetAgentIds);
    const desiredTypes = subtasks.map(s => s.type);
    const instructionByType = new Map(subtasks.map(s => [s.type, s.instruction]));

    const existingSnap = await adminDb.collection('socmedSubmissions')
      .where('campaign_id', '==', campaignId)
      .get();

    const batch = adminDb.batch();

    // Index existing per-agent submissions; delete any legacy per-(agent,subtask) docs.
    const existingByAgent = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    for (const doc of existingSnap.docs) {
      const data = doc.data();
      if (Array.isArray(data.subtasks)) {
        existingByAgent.set(data.agent_id, doc);
      } else {
        batch.delete(doc.ref);
      }
    }

    // Update campaign config
    const campaignRef = adminDb.collection('socmedCampaigns').doc(campaignId);
    batch.update(campaignRef, {
      subtasks: JSON.stringify(subtasks),
      target_agents: JSON.stringify(targetAgentIds),
      deadline,
      require_screenshot: !!requireScreenshot,
      allow_multiple_urls: !!allowMultipleUrls,
    });

    // Drop submissions for agents removed from the target list
    for (const [agentId, doc] of existingByAgent) {
      if (!desiredAgentSet.has(agentId)) {
        batch.delete(doc.ref);
      }
    }

    // Reconcile surviving submissions: for each agent still in the target list,
    // rebuild the subtasks array preserving status of subtasks whose type still applies,
    // adding fresh 'pending' for newly added types, dropping types that were removed.
    for (const agentId of targetAgentIds) {
      const existingDoc = existingByAgent.get(agentId);
      if (existingDoc) {
        const data = existingDoc.data();
        const oldByType = new Map<string, SubtaskItem>(
          (data.subtasks as SubtaskItem[]).map(st => [st.type, st])
        );
        const newSubtasks: SubtaskItem[] = desiredTypes.map(type => {
          const old = oldByType.get(type);
          if (old) {
            return {
              ...old,
              instruction: instructionByType.get(type) || old.instruction,
            };
          }
          return {
            type,
            instruction: instructionByType.get(type) || '',
            status: 'pending',
            failure_reason: null,
            checked_by: null,
            checked_at: null,
          };
        });
        const overall = deriveOverallStatus(newSubtasks, !!data.submitted_at);
        batch.update(existingDoc.ref, {
          subtasks: newSubtasks,
          overall_status: overall,
          updated_at: FieldValue.serverTimestamp(),
        });
      } else {
        // Newly added agent
        const subId = generateId();
        const subRef = adminDb.collection('socmedSubmissions').doc(subId);
        batch.set(subRef, {
          id: subId,
          campaign_id: campaignId,
          agent_id: agentId,
          subtasks: buildSubtaskItems(subtasks),
          proof_urls: null,
          proof_screenshot_url: null,
          proof_note: null,
          submitted_at: null,
          overall_status: 'pending',
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
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

async function setSubtaskStatus(
  submissionId: string,
  subtaskType: string,
  newStatus: 'pending' | 'done' | 'passed' | 'failed',
  failureReason: string | null,
  checkedByUid: string | null,
  expectedAgentId: string | null,
  expectedFromStatuses: ('pending' | 'done' | 'passed' | 'failed')[] | null,
) {
  const ref = adminDb.collection('socmedSubmissions').doc(submissionId);

  return adminDb.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false as const, error: 'Submission not found.' };
    const data = snap.data()!;

    if (expectedAgentId && data.agent_id !== expectedAgentId) {
      return { ok: false as const, error: 'You can only modify your own submission.' };
    }

    const subtasks: SubtaskItem[] = Array.isArray(data.subtasks) ? data.subtasks : [];
    const idx = subtasks.findIndex(st => st.type === subtaskType);
    if (idx === -1) return { ok: false as const, error: `Subtask ${subtaskType} not found on this submission.` };

    const current = subtasks[idx];
    if (expectedFromStatuses && !expectedFromStatuses.includes(current.status)) {
      return { ok: false as const, error: `Subtask cannot transition from ${current.status} to ${newStatus}.` };
    }

    const updatedSubtask: SubtaskItem = {
      ...current,
      status: newStatus,
      failure_reason: newStatus === 'failed' ? failureReason : null,
      checked_by: (newStatus === 'passed' || newStatus === 'failed') ? checkedByUid : current.checked_by,
      checked_at: (newStatus === 'passed' || newStatus === 'failed') ? FieldValue.serverTimestamp() : current.checked_at,
    };
    const newSubtasks = subtasks.map((st, i) => i === idx ? updatedSubtask : st);
    const hasProof = !!data.submitted_at;
    const overall = deriveOverallStatus(newSubtasks, hasProof);

    tx.update(ref, {
      subtasks: newSubtasks,
      overall_status: overall,
      updated_at: FieldValue.serverTimestamp(),
    });
    return { ok: true as const };
  });
}

export async function markSubtaskDone(
  submissionId: string,
  subtaskType: string,
  actorToken: ActorToken
) {
  try {
    const actor = await resolveActor(actorToken);
    const result = await setSubtaskStatus(submissionId, subtaskType, 'done', null, null, actor.uid, ['pending']);
    if (!result.ok) return { success: false, error: result.error };
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function unmarkSubtaskDone(
  submissionId: string,
  subtaskType: string,
  actorToken: ActorToken
) {
  try {
    const actor = await resolveActor(actorToken);
    // Only allow unmarking before proof has been submitted (no checked status yet)
    const ref = adminDb.collection('socmedSubmissions').doc(submissionId);
    const snap = await ref.get();
    if (!snap.exists) return { success: false, error: 'Submission not found.' };
    const data = snap.data()!;
    if (data.submitted_at) return { success: false, error: 'Proof already submitted; subtasks are locked.' };

    const result = await setSubtaskStatus(submissionId, subtaskType, 'pending', null, null, actor.uid, ['done']);
    if (!result.ok) return { success: false, error: result.error };
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function submitCampaignProof(
  submissionId: string,
  proofUrls: string[],
  proofScreenshotUrl: string | null,
  proofNote: string,
  actorToken: ActorToken
) {
  try {
    const actor = await resolveActor(actorToken);
    const ref = adminDb.collection('socmedSubmissions').doc(submissionId);

    return await adminDb.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) return { success: false, error: 'Submission not found.' };
      const data = snap.data()!;

      if (data.agent_id !== actor.uid) {
        return { success: false, error: 'You can only submit proof for your own submission.' };
      }
      if (data.submitted_at) {
        return { success: false, error: 'Proof has already been submitted.' };
      }

      const subtasks: SubtaskItem[] = Array.isArray(data.subtasks) ? data.subtasks : [];
      if (subtasks.length === 0) {
        return { success: false, error: 'No subtasks to submit proof for.' };
      }
      if (!subtasks.every(st => st.status === 'done')) {
        return { success: false, error: 'Mark every subtask as done before submitting proof.' };
      }

      // Load campaign for config
      const campaignSnap = await tx.get(adminDb.collection('socmedCampaigns').doc(data.campaign_id));
      if (!campaignSnap.exists) return { success: false, error: 'Campaign not found.' };
      const campaign = campaignSnap.data()!;
      const requireScreenshot = !!campaign.require_screenshot;
      const allowMultipleUrls = campaign.allow_multiple_urls !== false;

      const cleanUrls = proofUrls.map(u => (u || '').trim()).filter(Boolean);
      if (cleanUrls.length === 0) {
        return { success: false, error: 'At least one proof URL is required.' };
      }
      if (!allowMultipleUrls && cleanUrls.length > 1) {
        return { success: false, error: 'This campaign accepts only a single proof URL.' };
      }
      const cleanScreenshot = (proofScreenshotUrl || '').trim() || null;
      if (requireScreenshot && !cleanScreenshot) {
        return { success: false, error: 'Screenshot URL is required for this campaign.' };
      }

      tx.update(ref, {
        proof_urls: cleanUrls,
        proof_screenshot_url: cleanScreenshot,
        proof_note: proofNote.trim() || null,
        submitted_at: FieldValue.serverTimestamp(),
        overall_status: 'submitted',
        updated_at: FieldValue.serverTimestamp(),
      });
      return { success: true };
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function checkSubtask(
  submissionId: string,
  subtaskType: string,
  newStatus: 'passed' | 'failed',
  failureReason: string,
  actorToken: ActorToken
) {
  try {
    const actor = await resolveActor(actorToken);
    if (!canCheck(actor)) {
      return { success: false, error: 'Permission denied. Only Admin, Manager, Validator, or Checker can grade subtasks.' };
    }
    if (newStatus === 'failed' && !failureReason.trim()) {
      return { success: false, error: 'Failure reason is required when marking a subtask failed.' };
    }

    const ref = adminDb.collection('socmedSubmissions').doc(submissionId);
    const snap = await ref.get();
    if (!snap.exists) return { success: false, error: 'Submission not found.' };
    const data = snap.data()!;
    if (!data.submitted_at) return { success: false, error: 'Agent has not submitted proof yet.' };

    const result = await setSubtaskStatus(
      submissionId,
      subtaskType,
      newStatus,
      newStatus === 'failed' ? failureReason.trim() : null,
      actor.uid,
      null,
      ['done', 'passed', 'failed']
    );
    if (!result.ok) return { success: false, error: result.error };
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
    const actor = await resolveActor(actorToken);
    if (!canManageUsers(actor)) {
      return { success: false, error: 'Permission denied. Only SocMed Admins or Managers can update roles.' };
    }

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
    const actor = await resolveActor(actorToken);
    if (!canManageUsers(actor)) {
      return { success: false, error: 'Permission denied. Only SocMed Admins or Managers can create SocMed users.' };
    }

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
    const actor = await resolveActor(actorToken);
    if (!canManageUsers(actor)) {
      return { success: false, error: 'Permission denied. Only SocMed Admins or Managers can remove users.' };
    }

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

// ---- Group Management Actions ----

function canManageGroups(actor: VerifiedActor): boolean {
  const role = actor.profile?.socmedRole;
  return actor.isPlatformAdmin || role === 'Admin' || role === 'Manager';
}

export async function createSocmedGroup(
  name: string,
  description: string,
  agentIds: string[],
  actorToken: ActorToken
) {
  try {
    const actor = await resolveActor(actorToken);
    if (!canManageGroups(actor)) {
      return { success: false, error: 'Permission denied. Only SocMed Admins or Managers can manage groups.' };
    }

    const ref = adminDb.collection('socmedGroups').doc();
    await ref.set({
      name: name.trim(),
      description: description.trim(),
      agentIds,
      createdBy: actor.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true, id: ref.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateSocmedGroup(
  groupId: string,
  updates: { name?: string; description?: string; agentIds?: string[] },
  actorToken: ActorToken
) {
  try {
    const actor = await resolveActor(actorToken);
    if (!canManageGroups(actor)) {
      return { success: false, error: 'Permission denied. Only SocMed Admins or Managers can manage groups.' };
    }

    const payload: Record<string, any> = { updatedAt: FieldValue.serverTimestamp() };
    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.description !== undefined) payload.description = updates.description.trim();
    if (updates.agentIds !== undefined) payload.agentIds = updates.agentIds;

    await adminDb.collection('socmedGroups').doc(groupId).update(payload);

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteSocmedGroup(groupId: string, actorToken: ActorToken) {
  try {
    const actor = await resolveActor(actorToken);
    if (!canManageGroups(actor)) {
      return { success: false, error: 'Permission denied. Only SocMed Admins or Managers can manage groups.' };
    }

    await adminDb.collection('socmedGroups').doc(groupId).delete();

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
