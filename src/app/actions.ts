'use server';

import {
  generateBarangayProfiles as generateBarangayProfilesFlow,
  type GenerateBarangayProfilesInput,
} from '@/ai/flows/generate-barangay-profiles';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ProjectRecord, Barangay, CaptainProfile, UserProfile, Department, Role, MedicalRecord, Hospital, RequestRecord, RequestStatus, TaskRecord, TaskStatus } from '@/lib/types';
import { logAudit } from '@/lib/audit';
import { assertActor, type VerifiedActor } from '@/lib/server-auth';

type ActorToken = string;

async function resolveActor(token: ActorToken): Promise<VerifiedActor> {
  return assertActor(token);
}

export async function generateBarangayProfiles(input: GenerateBarangayProfilesInput, actorToken: ActorToken) {
  try {
    const actor = await resolveActor(actorToken);
    const result = await generateBarangayProfilesFlow(input);

    await logAudit({
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: 'generate_ai_profile',
      entityType: 'barangay',
      entityId: input.barangayName,
      details: { input, profileCount: result.profiles.length }
    });

    if (!result || !result.profiles) {
      throw new Error("AI failed to generate profiles.");
    }
    return { success: true, data: result.profiles };
  } catch (error) {
    console.error('Error generating barangay profiles:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { success: false, error: `Failed to generate profiles: ${errorMessage}` };
  }
}

type AddBarangayData = Omit<Barangay, 'id' | 'createdAt' | 'updatedAt'>;

export async function addBarangay(data: AddBarangayData, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const batch = adminDb.batch();
        const newBrgyRef = adminDb.collection('barangays').doc();

        batch.set(newBrgyRef, {
            ...data,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        const listItemData = {
            name: data.name,
            districtId: data.districtId,
            districtName: data.districtName,
            population: data.population,
            votingPopulation: data.votingPopulation,
            rsrVotes: data.rsrVotes,
            favoredVotePct: data.favoredVotePct,
            isWin: data.isWin,
        };

        const listDocRef = adminDb.collection('lists').doc('barangays');
        batch.set(listDocRef, {
            barangays: {
                [newBrgyRef.id]: listItemData
            }
        }, { merge: true });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'create',
            entityType: 'barangay',
            entityId: newBrgyRef.id,
            districtId: data.districtId,
            details: data,
        });

        await batch.commit();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateBarangay(id: string, data: Partial<Omit<Barangay, 'id'>>, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const batch = adminDb.batch();
        const brgyDoc = adminDb.collection('barangays').doc(id);

        batch.update(brgyDoc, {
            ...data,
            updatedAt: FieldValue.serverTimestamp(),
        });

        const listUpdateData: Record<string, any> = {};
        if (data.name !== undefined) listUpdateData[`barangays.${id}.name`] = data.name;
        if (data.districtId !== undefined) listUpdateData[`barangays.${id}.districtId`] = data.districtId;
        if (data.districtName !== undefined) listUpdateData[`barangays.${id}.districtName`] = data.districtName;
        if (data.population !== undefined) listUpdateData[`barangays.${id}.population`] = data.population;
        if (data.votingPopulation !== undefined) listUpdateData[`barangays.${id}.votingPopulation`] = data.votingPopulation;
        if (data.rsrVotes !== undefined) listUpdateData[`barangays.${id}.rsrVotes`] = data.rsrVotes;
        if (data.favoredVotePct !== undefined) listUpdateData[`barangays.${id}.favoredVotePct`] = data.favoredVotePct;
        if (data.isWin !== undefined) listUpdateData[`barangays.${id}.isWin`] = data.isWin;

        if (Object.keys(listUpdateData).length > 0) {
            const listDocRef = adminDb.collection('lists').doc('barangays');
            batch.update(listDocRef, listUpdateData);
        }

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'update',
            entityType: 'barangay',
            entityId: id,
            details: data,
        });

        await batch.commit();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteBarangay(id: string, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const batch = adminDb.batch();
        const brgyDoc = adminDb.collection('barangays').doc(id);
        batch.delete(brgyDoc);

        const listDocRef = adminDb.collection('lists').doc('barangays');
        batch.update(listDocRef, {
            [`barangays.${id}`]: FieldValue.delete()
        });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'delete',
            entityType: 'barangay',
            entityId: id,
        });

        await batch.commit();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function bulkAddBarangays(data: Omit<Barangay, 'id' | 'createdAt' | 'updatedAt'>[], actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const batch = adminDb.batch();

        const listUpdates: Record<string, any> = {};

        data.forEach(brgyData => {
            const docRef = adminDb.collection('barangays').doc();
            batch.set(docRef, {
                ...brgyData,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });

            const listItemData = {
                name: brgyData.name,
                districtId: brgyData.districtId,
                districtName: brgyData.districtName,
                population: brgyData.population,
                votingPopulation: brgyData.votingPopulation,
                rsrVotes: brgyData.rsrVotes,
                favoredVotePct: brgyData.favoredVotePct,
                isWin: brgyData.isWin,
            };
            listUpdates[docRef.id] = listItemData;
        });

        const listDocRef = adminDb.collection('lists').doc('barangays');
        batch.set(listDocRef, { barangays: listUpdates }, { merge: true });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'bulk_update',
            entityType: 'system',
            entityId: 'barangays_collection',
            details: { operation: 'bulkAddBarangays', count: data.length },
        });

        await batch.commit();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}


export async function updateUserAccess(uid: string, data: Partial<UserProfile>, actorToken: ActorToken, originalData: Partial<UserProfile>) {
    try {
        const actor = await resolveActor(actorToken);
        const userDoc = adminDb.collection('users').doc(uid);
        await userDoc.update({ ...data, updatedAt: FieldValue.serverTimestamp() });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'access_update',
            entityType: 'user',
            entityId: uid,
            details: { before: originalData, after: data },
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateSelfProfile(uid: string, data: { displayName: string, photoURL: string }, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        if (actor.uid !== uid) {
            return { success: false, error: 'Permission denied. You can only update your own profile.' };
        }

        const userDoc = adminDb.collection('users').doc(uid);
        await userDoc.update({
            displayName: data.displayName,
            photoURL: data.photoURL,
            updatedAt: FieldValue.serverTimestamp(),
        });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'update',
            entityType: 'user',
            entityId: uid,
            details: { self_profile_update: data },
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateCaptainProfile(brgyId: string, isCreating: boolean, data: Partial<Omit<CaptainProfile, 'createdAt'>>, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const batch = adminDb.batch();
        const profileDoc = adminDb.collection(`barangays/${brgyId}/captainProfile`).doc('main');

        const updateData = {
            ...data,
            updatedAt: FieldValue.serverTimestamp(),
            updatedByUid: actor.uid,
            updatedByEmail: actor.email,
        };

        if (isCreating) {
            batch.set(profileDoc, {
                ...updateData,
                createdAt: FieldValue.serverTimestamp(),
                createdByUid: actor.uid,
                createdByEmail: actor.email,
            });
        } else {
            batch.update(profileDoc, updateData);
        }

        await batch.commit();

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: isCreating ? 'create' : 'update',
            entityType: 'captainProfile',
            entityId: profileDoc.id,
            details: data,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

type AddProjectData = Omit<ProjectRecord, 'id' | 'createdAt' | 'updatedAt' | 'createdByUid'>;

export async function addProjectRecord(data: AddProjectData, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const newRecordRef = adminDb.collection('projectRecords').doc();
        await newRecordRef.set({
            ...data,
            createdByUid: actor.uid,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'create',
            entityType: 'projectRecord',
            entityId: newRecordRef.id,
            details: data,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateProjectRecord(id: string, data: Partial<Omit<ProjectRecord, 'id'>>, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const recordDoc = adminDb.collection('projectRecords').doc(id);
        await recordDoc.update({
            ...data,
            updatedAt: FieldValue.serverTimestamp(),
        });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'update',
            entityType: 'projectRecord',
            entityId: id,
            details: data,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteProjectRecord(id: string, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        await adminDb.collection('projectRecords').doc(id).delete();

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'delete',
            entityType: 'projectRecord',
            entityId: id,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

type AddDepartmentData = Omit<Department, 'id' | 'createdAt' | 'updatedAt'>;

export async function addDepartment(data: AddDepartmentData, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const newDeptId = adminDb.collection('_').doc().id;
        const listDocRef = adminDb.collection('lists').doc('departments');

        const newItemData = {
            ...data,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        await listDocRef.set({
            departments: { [newDeptId]: newItemData }
        }, { merge: true });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'create',
            entityType: 'department',
            entityId: newDeptId,
            details: data,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateDepartment(id: string, data: Partial<Omit<Department, 'id' | 'createdAt' | 'updatedAt'>>, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const listDocRef = adminDb.collection('lists').doc('departments');

        const updatePayload: Record<string, any> = {
            [`departments.${id}.updatedAt`]: FieldValue.serverTimestamp()
        };
        if (data.name !== undefined) updatePayload[`departments.${id}.name`] = data.name;
        if (data.description !== undefined) updatePayload[`departments.${id}.description`] = data.description;
        if (data.pageVisibility !== undefined) updatePayload[`departments.${id}.pageVisibility`] = data.pageVisibility;

        await listDocRef.update(updatePayload);

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'update',
            entityType: 'department',
            entityId: id,
            details: data,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteDepartment(id: string, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const listDocRef = adminDb.collection('lists').doc('departments');
        await listDocRef.update({ [`departments.${id}`]: FieldValue.delete() });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'delete',
            entityType: 'department',
            entityId: id,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}


type AddRoleData = { name: string };

export async function addRole(data: AddRoleData, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const newRoleId = adminDb.collection('_').doc().id;
        const listDocRef = adminDb.collection('lists').doc('roles');

        const newItemData = {
            name: data.name,
            rank: 20,
            scopeBreadth: 'own_districts',
            isBuiltIn: false,
            status: 'active',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        await listDocRef.set({ roles: { [newRoleId]: newItemData } }, { merge: true });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'create',
            entityType: 'role',
            entityId: newRoleId,
            details: data,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateRole(id: string, data: Partial<Omit<Role, 'id' | 'createdAt' | 'updatedAt'>>, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const listDocRef = adminDb.collection('lists').doc('roles');

        const snap = await listDocRef.get();
        const existing = snap.exists ? (snap.data() as any)?.roles?.[id] : null;
        if (existing?.isBuiltIn && (data.rank !== undefined || data.scopeBreadth !== undefined || data.isBuiltIn !== undefined)) {
            throw new Error('Cannot change rank, scopeBreadth, or isBuiltIn on a built-in role.');
        }

        const updatePayload: Record<string, any> = {
            [`roles.${id}.updatedAt`]: FieldValue.serverTimestamp()
        };
        if (data.name !== undefined) updatePayload[`roles.${id}.name`] = data.name;
        if (data.rank !== undefined && !existing?.isBuiltIn) updatePayload[`roles.${id}.rank`] = data.rank;
        if (data.scopeBreadth !== undefined && !existing?.isBuiltIn) updatePayload[`roles.${id}.scopeBreadth`] = data.scopeBreadth;
        if (data.status !== undefined) updatePayload[`roles.${id}.status`] = data.status;
        if (data.preset !== undefined) updatePayload[`roles.${id}.preset`] = data.preset;

        await listDocRef.update(updatePayload);

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'update',
            entityType: 'role',
            entityId: id,
            details: data,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteRole(id: string, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const listDocRef = adminDb.collection('lists').doc('roles');

        const snap = await listDocRef.get();
        const existing = snap.exists ? (snap.data() as any)?.roles?.[id] : null;
        if (existing?.isBuiltIn) throw new Error('Built-in roles cannot be deleted.');

        await listDocRef.update({ [`roles.${id}`]: FieldValue.delete() });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'delete',
            entityType: 'role',
            entityId: id,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

type AddMedicalRecordData = Omit<MedicalRecord, 'id' | 'createdAt' | 'updatedAt' | 'createdByUid' | 'projectId'>;

export async function addMedicalRecord(data: AddMedicalRecordData, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const newRecordRef = adminDb.collection('medicalRecords').doc();

        const projectId = `MED-${newRecordRef.id.substring(0, 8).toUpperCase()}`;

        await newRecordRef.set({
            ...data,
            projectId,
            createdByUid: actor.uid,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'create',
            entityType: 'medicalRecord',
            entityId: newRecordRef.id,
            districtId: data.districtId,
            details: data,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateMedicalRecord(id: string, data: Partial<Omit<MedicalRecord, 'id'>>, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const recordDoc = adminDb.collection('medicalRecords').doc(id);
        await recordDoc.update({
            ...data,
            updatedAt: FieldValue.serverTimestamp(),
        });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'update',
            entityType: 'medicalRecord',
            entityId: id,
            districtId: data.districtId,
            details: data,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteMedicalRecord(id: string, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        await adminDb.collection('medicalRecords').doc(id).delete();

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'delete',
            entityType: 'medicalRecord',
            entityId: id,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

type AddHospitalData = Omit<Hospital, 'id' | 'createdAt' | 'updatedAt'>;

export async function addHospital(data: AddHospitalData, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const newId = adminDb.collection('_').doc().id;
        const listDocRef = adminDb.collection('lists').doc('hospitals');
        const newItemData = { ...data, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
        await listDocRef.set({ hospitals: { [newId]: newItemData } }, { merge: true });
        await logAudit({ actorUid: actor.uid, actorEmail: actor.email, action: 'create', entityType: 'hospital', entityId: newId, details: data });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateHospital(id: string, data: Partial<Omit<Hospital, 'id' | 'createdAt' | 'updatedAt'>>, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const listDocRef = adminDb.collection('lists').doc('hospitals');
        const updatePayload: Record<string, any> = { [`hospitals.${id}.updatedAt`]: FieldValue.serverTimestamp() };
        if (data.name !== undefined) updatePayload[`hospitals.${id}.name`] = data.name;
        if (data.address !== undefined) updatePayload[`hospitals.${id}.address`] = data.address;
        await listDocRef.update(updatePayload);
        await logAudit({ actorUid: actor.uid, actorEmail: actor.email, action: 'update', entityType: 'hospital', entityId: id, details: data });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteHospital(id: string, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const listDocRef = adminDb.collection('lists').doc('hospitals');
        await listDocRef.update({ [`hospitals.${id}`]: FieldValue.delete() });
        await logAudit({ actorUid: actor.uid, actorEmail: actor.email, action: 'delete', entityType: 'hospital', entityId: id });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// ---- Request / Receiving Actions ----

type AddRequestData = Omit<RequestRecord, 'id' | 'createdAt' | 'updatedAt' | 'createdByUid' | 'status' | 'reviewNotes' | 'reviewedByUid' | 'reviewedAt'>;

export async function addRequest(data: AddRequestData, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const newRef = adminDb.collection('requests').doc();
        await newRef.set({
            ...data,
            status: 'pending' as RequestStatus,
            createdByUid: actor.uid,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
        await logAudit({ actorUid: actor.uid, actorEmail: actor.email, action: 'create', entityType: 'request', entityId: newRef.id, districtId: data.districtId });
        return { success: true, id: newRef.id };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateRequest(id: string, data: Partial<Omit<RequestRecord, 'id'>>, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const docRef = adminDb.collection('requests').doc(id);
        await docRef.update({ ...data, updatedAt: FieldValue.serverTimestamp() });
        await logAudit({ actorUid: actor.uid, actorEmail: actor.email, action: 'update', entityType: 'request', entityId: id });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteRequest(id: string, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        await adminDb.collection('requests').doc(id).delete();
        await logAudit({ actorUid: actor.uid, actorEmail: actor.email, action: 'delete', entityType: 'request', entityId: id });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateRequestStatus(
    id: string,
    newStatus: RequestStatus,
    actorToken: ActorToken,
    reviewNotes?: string
) {
    try {
        const actor = await resolveActor(actorToken);
        const docRef = adminDb.collection('requests').doc(id);
        const updateData: Record<string, any> = {
            status: newStatus,
            updatedAt: FieldValue.serverTimestamp(),
        };
        if (newStatus === 'approved' || newStatus === 'rejected') {
            updateData.reviewedByUid = actor.uid;
            updateData.reviewedAt = FieldValue.serverTimestamp();
            if (reviewNotes) updateData.reviewNotes = reviewNotes;
        }
        if (newStatus === 'pending') {
            updateData.reviewedByUid = null;
            updateData.reviewedAt = null;
            updateData.reviewNotes = null;
        }
        await docRef.update(updateData);
        await logAudit({ actorUid: actor.uid, actorEmail: actor.email, action: 'status_change', entityType: 'request', entityId: id, details: { newStatus, reviewNotes } });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// ---- Tasker Actions ----

type AddTaskData = Omit<TaskRecord, 'id' | 'createdAt' | 'updatedAt'>;

export async function addTask(data: AddTaskData, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const newRef = adminDb.collection('tasks').doc();
        await newRef.set({
            ...data,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
        await logAudit({ actorUid: actor.uid, actorEmail: actor.email, action: 'create', entityType: 'task', entityId: newRef.id });
        return { success: true, id: newRef.id };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateTask(id: string, data: Partial<Omit<TaskRecord, 'id'>>, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        await adminDb.collection('tasks').doc(id).update({ ...data, updatedAt: FieldValue.serverTimestamp() });
        await logAudit({ actorUid: actor.uid, actorEmail: actor.email, action: 'update', entityType: 'task', entityId: id });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateTaskStatus(id: string, newStatus: TaskStatus, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        await adminDb.collection('tasks').doc(id).update({ status: newStatus, updatedAt: FieldValue.serverTimestamp() });
        await logAudit({ actorUid: actor.uid, actorEmail: actor.email, action: 'status_change', entityType: 'task', entityId: id, details: { newStatus } });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteTask(id: string, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        await adminDb.collection('tasks').doc(id).delete();
        await logAudit({ actorUid: actor.uid, actorEmail: actor.email, action: 'delete', entityType: 'task', entityId: id });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
